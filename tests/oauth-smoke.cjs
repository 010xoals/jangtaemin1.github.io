"use strict";
const fs=require("node:fs"),vm=require("node:vm"),assert=require("node:assert/strict");
const configContext={window:{}};vm.runInNewContext(fs.readFileSync("config/public.js","utf8"),configContext);
const config=configContext.window.RESONG_PUBLIC_CONFIG;
async function main(){
  assert(/^https:\/\/[a-z0-9]+\.supabase\.co$/.test(config.url),"Supabase project URL invalid");
  assert(/^sb_publishable_[\w-]+$/.test(config.publishableKey),"Missing safe publishable key");
  const headers={apikey:config.publishableKey,Accept:"application/json"};
  const settingsResp=await fetch(config.url+"/auth/v1/settings",{headers,signal:AbortSignal.timeout(18000)});
  if(!settingsResp.ok)throw Error("Auth settings HTTP "+settingsResp.status);
  const settings=await settingsResp.json();
  const google=Boolean(settings.external?.google);
  const clientRead=await fetch(config.url+"/rest/v1/songs?select=id&limit=1",{headers,signal:AbortSignal.timeout(18000)});
  const ratingRead=await fetch(config.url+"/rest/v1/song_rating_summary?select=song_id,rating_count&limit=1",{headers,signal:AbortSignal.timeout(18000)});
  const profileRead=await fetch(config.url+"/rest/v1/profiles?select=id&limit=1",{headers,signal:AbortSignal.timeout(18000)});
  const summary={google_enabled:google,catalog_public_read:clientRead.ok,summary_public_read:ratingRead.ok,profiles_public_read:profileRead.ok,site_url_domain:(()=>{try{return new URL(settings.site_url).hostname}catch{return null}})()};
  console.log("RESONG_AUTH_SMOKE "+JSON.stringify(summary));
  assert(clientRead.ok,"Cannot browse catalog with public key");
  assert(ratingRead.ok,"Cannot browse rating summaries with public key");
  assert(profileRead.ok,"Cannot browse public profile nicknames");
  assert(google,"Supabase Google OAuth provider is not enabled");
  const start=new URL(config.url+"/auth/v1/authorize");
  start.searchParams.set("provider","google");start.searchParams.set("redirect_to","https://www.jangtaemin1.com/");
  const res=await fetch(start,{headers,redirect:"manual",signal:AbortSignal.timeout(18000)});
  const location=res.headers.get("location")||"";
  const dest=location?new URL(location,config.url):null;
  // Log only redirect HOST, never query parameters or OAuth state.
  console.log("RESONG_AUTH_REDIRECT "+JSON.stringify({status:res.status,redirect_host:dest?.hostname||null,looksLikeGoogle:dest?.hostname==="accounts.google.com"}));
  assert([301,302,303,307,308].includes(res.status),"OAuth login did not return a redirect");
  assert(dest?.hostname==="accounts.google.com","OAuth sign-in failed to redirect to Google");
}
main().catch(e=>{console.error("AUTH_SMOKE_ERROR",e.message);process.exitCode=1});
