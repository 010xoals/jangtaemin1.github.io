/**
 * RE:SONG recent singles import (MusicBrainz + optional YouTube Data API).
 * Requires Node.js 20+. Does not fetch or download video/audio content.
 * MUSICBRAINZ_USER_AGENT should identify a reachable website/contact.
 */
"use strict";
const fs=require("node:fs/promises");
const path=require("node:path");
const API="https://musicbrainz.org/ws/2";
const OUTPUT=path.join(__dirname,"..","data","new-releases.json");
const API_KEY=process.env.YT_API_KEY||"";
const UA=process.env.MUSICBRAINZ_USER_AGENT||"RESONG/0.2 (https://jangtaemin1.com; https://github.com/010xoals/jangtaemin1.github.io)";
const MAX_PAGES=Math.max(1,Math.min(Number(process.env.MB_PAGES||3)||3,5));
const MAX_MATCHES=Number(process.env.MAX_YOUTUBE_SEARCHES||12);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const clock=()=>new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Seoul",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date()).replaceAll(".","");
function dateKST(){
  const parts=new Intl.DateTimeFormat("en-US",{timeZone:"Asia/Seoul",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date());
  const p=x=>parts.find(y=>y.type===x).value;
  return [p("year"),p("month"),p("day")].join("-");
}
function minusDays(date,n){const d=new Date(date+"T00:00:00Z");d.setUTCDate(d.getUTCDate()-n);return d.toISOString().slice(0,10)}
const fullDate=x=>typeof x==="string"&&/^\d{4}-\d\d-\d\d$/.test(x)&&!Number.isNaN(new Date(x+"T00:00:00Z").getTime());
let lastMB=0;
async function mb(url){
  const wait=Math.max(0,1150-(Date.now()-lastMB));if(wait)await sleep(wait);
  lastMB=Date.now();
  for(let i=0;i<4;i++){
    const r=await fetch(url,{headers:{"User-Agent":UA,"Accept":"application/json"}});
    if(r.ok)return r.json();
    if([429,500,502,503,504].includes(r.status)&&i<3){await sleep(1500*(i+1));continue}
    throw new Error("MusicBrainz "+r.status+" at "+String(url).split("?")[0]+" "+(await r.text()).slice(0,180));
  }
}
async function yt(endpoint,params){
  const u=new URL("https://www.googleapis.com/youtube/v3/"+endpoint);
  for(const [k,v] of Object.entries({...params,key:API_KEY}))u.searchParams.set(k,String(v));
  const r=await fetch(u,{headers:{Accept:"application/json"}});
  if(!r.ok){const details=(await r.text()).slice(0,200);throw new Error("YouTube API "+r.status+" "+details)}
  return r.json();
}
const normalize=s=>String(s||"").normalize("NFKC").toLocaleLowerCase().replace(/[^\p{L}\p{N}]/gu,"");
function youtubeMatch(song,items){
  const artist=normalize(song.artist),title=normalize(song.title);
  if(!artist||!title||title.length<2)return null;
  const matches=items.filter(x=>{
    const sn=x.snippet||{};const videoName=normalize(sn.title),channel=normalize(sn.channelTitle);
    const artistPresent=channel.includes(artist)||videoName.includes(artist);
    return videoName.includes(title)&&artistPresent&&!/(reaction|coverby|lyricsreaction|karaoke|8dversion)/i.test(videoName);
  });
  matches.sort((a,b)=>{
    const score=x=>{const c=normalize(x.snippet.channelTitle);return (c===artist||c===artist+"topic"?4:0)+(c.includes(artist)?2:0)+(/official|topic/i.test(x.snippet.channelTitle)?1:0)};
    return score(b)-score(a);
  });
  return matches[0]?.id?.videoId||null;
}
async function searchVideo(song){
  const results=await yt("search",{part:"snippet",type:"video",q:song.artist+" "+song.title+" official audio",maxResults:"6",videoEmbeddable:"true",safeSearch:"none"});
  const id=youtubeMatch(song,results.items||[]);
  if(!id)return null;
  const checked=await yt("videos",{part:"status",id});
  const status=checked.items?.[0]?.status||{};
  return status.embeddable===true&&status.privacyStatus==="public"?id:null;
}
async function fetchReleases(start,end){
  // MusicBrainz indexes partial dates (YYYY) together with precise dates.
  // Fetch all search pages before filtering for exact YYYY-MM-DD.
  const groups=[];
  const pageLimit=Math.min(5,Math.max(1,Number(process.env.MB_SEARCH_PAGES||5)));
  for(let date=end;date>=start;date=minusDays(date,1)){
    let fetched=0,total=0,exact=0;
    for(let page=0;page<pageLimit;page++){
      const u=new URL(API+"/release-group");
      u.searchParams.set("query","firstreleasedate:"+date+" AND primarytype:single");
      u.searchParams.set("fmt","json");u.searchParams.set("limit","100");
      u.searchParams.set("offset",String(page*100));
      const j=await mb(u);
      const found=j["release-groups"]||[];
      total=Number(j.count||0);
      const dated=found.filter(g=>g["first-release-date"]===date);
      groups.push(...dated);
      fetched+=found.length;exact+=dated.length;
      if(!found.length||fetched>=total)break;
    }
    console.log("Search day summary",JSON.stringify({date,total,fetched,exact}));
  }
  return groups;
}
async function classifyArtist(artistID,cache){
  if(!artistID)return null;
  if(cache.has(artistID))return cache.get(artistID);
  const u=new URL(API+"/artist/"+encodeURIComponent(artistID));u.searchParams.set("fmt","json");
  let c=null;
  try {
    const artist=await mb(u);
    const country=String(artist.country||artist.area?.["iso-3166-1-codes"]?.[0]||"").toUpperCase();
    if(/^[A-Z]{2}$/.test(country))c={code:["KR","JP","US"].includes(country)?country:"OTHER",name:country};
  }catch(e){console.warn("Artist lookup skipped:",artistID,String(e.message).slice(0,80))}
  cache.set(artistID,c);return c;
}
async function loadPrevious(){
  try {const old=JSON.parse(await fs.readFile(OUTPUT,"utf8"));return new Map((Array.isArray(old)?old:old.items||[]).map(x=>[x.id,x]))}
  catch{return new Map()}
}
async function main(){
  const end=dateKST(),start=minusDays(end,6);
  const groups=await fetchReleases(start,end);
  const previous=await loadPrevious();
  const artists=new Map(),unique=new Map();
  console.log("MusicBrainz search diagnostics",JSON.stringify({first:groups.slice(0,3).map(g=>({type:g["primary-type"],date:g["first-release-date"],artistCreditCount:(g["artist-credit"]||[]).length})),dated:groups.filter(g=>fullDate(g["first-release-date"])).length,withinRange:groups.filter(g=>g["first-release-date"]>=start&&g["first-release-date"]<=end).length,typedSingle:groups.filter(g=>String(g["primary-type"]).toLowerCase()==="single").length}));
  const candidates=groups.filter(g=>fullDate(g["first-release-date"])&&g["first-release-date"]>=start&&g["first-release-date"]<=end&&(g["primary-type"]||"").toLowerCase()==="single");
  candidates.sort((a,b)=>String(b["first-release-date"]).localeCompare(String(a["first-release-date"])));
  for(const g of candidates){
    const primary=(g["artist-credit"]||[]).find(c=>c.artist)?.artist;
    if(!g.id||!primary?.id||!g.title||unique.has(g.id))continue;
    const country=await classifyArtist(primary.id,artists);
    if(!country)continue; // no reliable artist origin: do not guess from release territory or genre
    unique.set(g.id,{id:g.id,title:g.title,artist:g["artist-credit"].filter(x=>x.name).map(x=>x.name).join("")||primary.name,release_date:g["first-release-date"],country_code:country.code,country_name:country.name,source:"MusicBrainz",source_url:"https://musicbrainz.org/release-group/"+g.id,video_id:null});
  }
  const songs=[...unique.values()];
  const byRegion={KR:0,JP:0,US:0,OTHER:0},picked=[];
  for(const song of songs){
    if(byRegion[song.country_code]>=20)continue;
    picked.push(song);byRegion[song.country_code]++;
    if(picked.length>=80)break;
  }
  let searches=0,matched=0;
  for(const song of picked){
    const old=previous.get(song.id);
    if(old?.video_id&&/^[\w-]{11}$/.test(old.video_id)){
      song.video_id=old.video_id; // retain ID; client may show unavailable-video fallback
      continue;
    }
    if(!API_KEY||searches>=MAX_MATCHES)continue;
    searches++;
    try {song.video_id=await searchVideo(song);if(song.video_id)matched++}
    catch(e){console.warn("Video unverified:",song.title,String(e.message).slice(0,150))}
  }
  await fs.mkdir(path.dirname(OUTPUT),{recursive:true});
  await fs.writeFile(OUTPUT,JSON.stringify({generated_at:new Date().toISOString(),range:{start,end},source:"MusicBrainz release groups (singles)",country_basis:"artist country (MusicBrainz area); unknown excluded",items:picked},null,2)+"\n");
  console.log(JSON.stringify({date_range:{start,end},release_groups:groups.length,classified:picked.length,by_region:byRegion,video_searches:searches,videos_matched:matched,youtube_key_configured:!!API_KEY}));
}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1});
module.exports={minusDays,fullDate,normalize,youtubeMatch};
