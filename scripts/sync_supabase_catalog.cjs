/**
 * RE:SONG catalog upsert: local generated MusicBrainz release feed -> Supabase songs.
 * This file runs ONLY in GitHub Actions/server, never in the web browser.
 * Required secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
 */
"use strict";
const fs=require("node:fs/promises");
const path=require("node:path");
const input=path.join(__dirname,"..","data","new-releases.json");
const SUPABASE_URL=process.env.SUPABASE_URL;
const SERVICE_KEY=process.env.SUPABASE_SERVICE_ROLE_KEY;
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const validVideo=id=>typeof id==="string"&&/^[\w-]{11}$/.test(id);
function toCatalogItems(items){
  if(!Array.isArray(items))throw Error("Missing items array");
  const dedupe=new Set();
  return items.filter(s=>s&&uuid.test(s.id)&&["KR","JP","US","OTHER"].includes(s.country_code)&&/^\d{4}-\d\d-\d\d$/.test(s.release_date)&&typeof s.title==="string"&&typeof s.artist==="string")
    .filter(s=>{if(dedupe.has(s.id))return false;dedupe.add(s.id);return true})
    .map(s=>({id:s.id,title:s.title.slice(0,240),artist:s.artist.slice(0,240),
      country_code:s.country_code,country_name:String(s.country_name||"").slice(0,15),
      first_release_date:s.release_date,
      musicbrainz_url:"https://musicbrainz.org/release-group/"+s.id,
      video_id:validVideo(s.video_id)?s.video_id:null}));
}
async function sync(){
  if(!SUPABASE_URL||!SERVICE_KEY)throw Error("Supabase server credentials not configured");
  const origin=new URL(SUPABASE_URL);
  if(origin.protocol!=="https:"||!/^https?:$/.test(origin.protocol))throw Error("SUPABASE_URL must be HTTPS");
  if(!origin.hostname.endsWith(".supabase.co"))throw Error("SUPABASE_URL must be a standard Supabase project URL");
  const data=JSON.parse(await fs.readFile(input,"utf8"));
  const rows=toCatalogItems(data.items);
  if(!rows.length)throw Error("Refusing to replace catalog: no source rows");
  let total=0;
  for(let i=0;i<rows.length;i+=100){
    const batch=rows.slice(i,i+100);
    const response=await fetch(origin.origin+"/rest/v1/songs?on_conflict=id",{
      method:"POST",
      headers:{"apikey":SERVICE_KEY,"Authorization":"Bearer "+SERVICE_KEY,
        "Content-Type":"application/json","Prefer":"resolution=merge-duplicates,return=minimal"},
      body:JSON.stringify(batch)
    });
    if(!response.ok){
      // Never print request headers or API key.
      throw Error("Supabase catalog sync HTTP "+response.status+" "+(await response.text()).slice(0,260));
    }
    total+=batch.length;
  }
  console.log("RESONG_CATALOG_SYNC",JSON.stringify({upserted:total}));
}
if(require.main===module)sync().catch(e=>{console.error(e.message);process.exitCode=1});
module.exports={toCatalogItems};
