/**
 * RE:SONG recent singles collector + YouTube video enrichment.
 * Node.js 22; keep secret YT_API_KEY in GitHub Actions, not on the site.
 * VIDEO_ONLY=1 enriches an existing feed without re-querying MusicBrainz.
 */
"use strict";
const fs=require("node:fs/promises");
const path=require("node:path");
const API="https://musicbrainz.org/ws/2";
const FILE=path.resolve(__dirname,"../data/new-releases.json");
const KEY=process.env.YT_API_KEY||"";
const UA=process.env.MUSICBRAINZ_USER_AGENT||"RESONG/0.3 (https://www.jangtaemin1.com/)";
const VIDEO_ONLY=process.env.VIDEO_ONLY==="1";
const MAX_SEARCHES=Math.max(0,Math.min(50,Number(process.env.MAX_YOUTUBE_SEARCHES||30)));
const SEARCH_PAGES=5;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
function dateKST(){
  const parts=new Intl.DateTimeFormat("en-US",{timeZone:"Asia/Seoul",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date());
  const p=k=>parts.find(x=>x.type===k).value;
  return [p("year"),p("month"),p("day")].join("-");
}
const back=(date,n)=>{const d=new Date(date+"T00:00:00Z");d.setUTCDate(d.getUTCDate()-n);return d.toISOString().slice(0,10)};
let nextMB=0;
async function mb(url){
  const wait=Math.max(0,nextMB-Date.now());if(wait)await sleep(wait);
  nextMB=Date.now()+1300;
  for(let n=0;n<4;n++){
    const r=await fetch(url,{headers:{"User-Agent":UA,Accept:"application/json"}});
    if(r.ok)return r.json();
    if([429,500,502,503,504].includes(r.status)&&n<3){await sleep(2000*(n+1));continue}
    throw Error("MusicBrainz "+r.status+" "+(await r.text()).slice(0,160));
  }
}
async function yt(endpoint,params){
  const url=new URL("https://www.googleapis.com/youtube/v3/"+endpoint);
  for(const [k,v] of Object.entries({...params,key:KEY}))url.searchParams.set(k,String(v));
  const r=await fetch(url,{headers:{Accept:"application/json"}});
  if(!r.ok){const body=(await r.text()).slice(0,180);throw Error("YouTube API "+r.status+": "+body)}
  return r.json();
}
const norm=s=>String(s||"").normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]/gu,"");
const isID=s=>typeof s==="string"&&/^[\w-]{11}$/.test(s);
function scoredCandidates(song,results){
  const artist=norm(song.artist),title=norm(song.title);
  if(!artist||title.length<3)return [];
  const unwanted=/(reaction|karaoke|nightcore|slowed|sped\s*up|8d audio|fan\s*made|instrumental cover)/i;
  return (results||[]).map(x=>{
    const videoId=x.id?.videoId,sn=x.snippet||{},name=norm(sn.title),channel=norm(sn.channelTitle);
    if(!isID(videoId)||!name.includes(title)||unwanted.test(sn.title||""))return null;
    if(!(name.includes(artist)||channel.includes(artist)))return null;
    const official=/official|topic|vevo/i.test(sn.channelTitle||"")||/official (music |audio|video|lyric)/i.test(sn.title||"");
    // High-scoring does not mean authenticated ownership: a manual moderation step is still needed.
    const score=(channel===artist||channel===artist+"topic"?9:0)+(channel.includes(artist)?4:0)+(name.includes(artist)?2:0)+(official?2:0);
    return {id:videoId,score,channel:(sn.channelTitle||"").slice(0,130)};
  }).filter(Boolean).sort((a,b)=>b.score-a.score);
}
async function findVideo(song){
  const q=song.artist+" "+song.title;
  const data=await yt("search",{part:"snippet",type:"video",videoEmbeddable:"true",q,maxResults:12});
  const candidates=scoredCandidates(song,data.items).slice(0,5);
  if(!candidates.length)return null;
  const details=await yt("videos",{part:"status,contentDetails",id:candidates.map(x=>x.id).join(",")});
  const byId=new Map((details.items||[]).map(x=>[x.id,x]));
  for(const item of candidates){
    const data=byId.get(item.id),status=data?.status;
    if(status?.embeddable===true&&status.privacyStatus==="public"){
      return {id:item.id,channel:item.channel,method:"automated_title_channel_match"};
    }
  }
  return null;
}
async function readFeed(){
  try {
    const j=JSON.parse(await fs.readFile(FILE,"utf8"));
    if(!Array.isArray(j.items))throw Error("feed has no items");
    return j;
  }catch(e){if(VIDEO_ONLY)throw Error("Video-only mode requires existing release feed: "+e.message);return {items:[]}}
}
async function collect(start,end){
  const groups=[];
  for(let date=end;date>=start;date=back(date,1)){
    let count=0;
    for(let page=0;page<SEARCH_PAGES;page++){
      const u=new URL(API+"/release-group");
      u.searchParams.set("query","firstreleasedate:"+date+" AND primarytype:single");
      u.searchParams.set("fmt","json");u.searchParams.set("limit","100");u.searchParams.set("offset",String(page*100));
      const j=await mb(u),found=j["release-groups"]||[];
      groups.push(...found.filter(x=>x["first-release-date"]===date&&String(x["primary-type"]).toLowerCase()==="single"));
      count+=found.length;
      if(!found.length||count>=Number(j.count||0))break;
    }
  }
  return groups;
}
async function artistRegion(id,cache){
  if(cache.has(id))return cache.get(id);
  let region=null;
  try {
    const u=new URL(API+"/artist/"+encodeURIComponent(id));u.searchParams.set("fmt","json");
    const j=await mb(u);
    const code=String(j.country||j.area?.["iso-3166-1-codes"]?.[0]||"").toUpperCase();
    if(/^[A-Z]{2}$/.test(code))region={code:["KR","JP","US"].includes(code)?code:"OTHER",name:code};
  }catch(e){console.warn("Country unavailable for artist",id,String(e.message).slice(0,100))}
  cache.set(id,region);return region;
}
const validDate=s=>typeof s==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(s);
function artistCredits(group){
  // MusicBrainz joinphrases are necessary for collaborations (e.g. "A & B").
  const s=(group["artist-credit"]||[]).map(c=>typeof c==="string"?c:(c.name||c.artist?.name||"")+(c.joinphrase||"")).join("").trim();
  return s||group["artist-credit"]?.find(c=>c.artist)?.artist?.name||"";
}
async function buildFeed(start,end,prior){
  const groups=await collect(start,end),regions=new Map(),newItems=[],seen=new Set(),counts={KR:0,JP:0,US:0,OTHER:0};
  groups.sort((a,b)=>String(b["first-release-date"]).localeCompare(String(a["first-release-date"])));
  for(const g of groups){
    const primary=(g["artist-credit"]||[]).find(c=>c?.artist)?.artist;
    if(!primary?.id||!g.id||seen.has(g.id)||!validDate(g["first-release-date"])||g["first-release-date"]<start||g["first-release-date"]>end)continue;
    seen.add(g.id);
    const loc=await artistRegion(primary.id,regions);
    if(!loc||counts[loc.code]>=20)continue;
    const old=prior.get(g.id)||{};
    newItems.push({id:g.id,title:g.title,artist:artistCredits(g),release_date:g["first-release-date"],country_code:loc.code,country_name:loc.name,source:"MusicBrainz",source_url:"https://musicbrainz.org/release-group/"+g.id,video_id:isID(old.video_id)?old.video_id:null,...(old.video_checked_at?{video_checked_at:old.video_checked_at}:{}),...(old.video_match_method?{video_match_method:old.video_match_method}:{})});
    counts[loc.code]++;
    if(newItems.length>=80)break;
  }
  console.log("MusicBrainz feed",JSON.stringify({candidates:groups.length,picked:newItems.length,countries:counts}));
  return newItems;
}
function roundRobin(items){
  // Equal opportunity for each requested region; don't spend the daily quota on one country.
  const regions=["KR","JP","US","OTHER"];
  const by=new Map(regions.map(r=>[r,items.filter(x=>x.country_code===r).sort((a,b)=>String(b.release_date).localeCompare(String(a.release_date)))]));
  const output=[];
  while(regions.some(r=>by.get(r).length)){
    for(const region of regions){const song=by.get(region).shift();if(song)output.push(song)}
  }
  return output;
}
function due(song,now){
  if(isID(song.video_id))return false;
  const t=Date.parse(song.video_checked_at||"");
  // A search with no result can be retried later; do not pay for it in every run.
  return Number.isNaN(t)||now-t>=24*60*60*1000;
}
async function enrich(items){
  if(!KEY){console.warn("No YouTube API key: video enrichment skipped");return {searched:0,linked:0,skipped:items.length}}
  const queue=roundRobin(items.filter(x=>due(x,Date.now())));let searched=0,linked=0,errors=0;
  for(const song of queue){
    if(searched>=MAX_SEARCHES)break;
    try{
      // Search is expensive: YouTube Data API search.list costs 100 quota units.
      const match=await findVideo(song);searched++;
      song.video_checked_at=new Date().toISOString();
      if(match){song.video_id=match.id;song.video_match_method=match.method;song.video_channel=match.channel;linked++}
    }catch(e){
      errors++;
      console.warn("Video search failed",song.id,String(e.message).slice(0,180));
      if(/quotaExceeded|dailyLimitExceeded|YouTube API 403/i.test(String(e.message)))break;
    }
  }
  return {searched,linked,errors,pending:items.filter(x=>!isID(x.video_id)).length};
}
async function main(){
  const end=dateKST(),start=back(end,6),old=await readFeed();
  const prior=new Map(old.items.map(x=>[x.id,x]));
  let songs=VIDEO_ONLY?old.items:await buildFeed(start,end,prior);
  // Never reinsert expired songs into the 7-day section.
  songs=songs.filter(x=>x.release_date>=start&&x.release_date<=end);
  const stats=await enrich(songs);
  const output={generated_at:new Date().toISOString(),range:{start,end},source:"MusicBrainz release groups (singles)",country_basis:"MusicBrainz artist country, not guaranteed activity location",items:songs};
  await fs.mkdir(path.dirname(FILE),{recursive:true});
  await fs.writeFile(FILE,JSON.stringify(output,null,2)+"\n");
  console.log("RESONG_COLLECT_RESULT",JSON.stringify({mode:VIDEO_ONLY?"videos-only":"full",total:songs.length,linkedTotal:songs.filter(x=>isID(x.video_id)).length,countries:songs.reduce((a,x)=>(a[x.country_code]=(a[x.country_code]||0)+1,a),{}),...stats}));
}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1});
module.exports={scoredCandidates,roundRobin,due,artistCredits,back};
