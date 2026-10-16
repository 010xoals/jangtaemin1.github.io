"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),vm=require("node:vm");
const path=require("node:path");
const root=path.resolve(__dirname,"..");
const read=p=>fs.readFileSync(path.join(root,p),"utf8");
const html=read("index.html"),community=read("assets/js/community.js");
const sql=read("supabase/migrations/20261016_community.sql");
const cfg=read("config/public.js");
const feed=JSON.parse(read("data/new-releases.json"));
const mapper=require("../scripts/sync_supabase_catalog.cjs").toCatalogItems;

test("both website and member code parse in Node JS VM",()=>{
  const inline=html.match(/<script>\s*([\s\S]*?)<\/script>/)?.[1]||"";
  assert.ok(inline.length>2000);
  new vm.Script(inline);
  new vm.Script(community);
});
test("all member UI targets exist in the HTML",()=>{
  const ids=["community-message","auth-signin","auth-signout","account-controls","account-name","account-nickname","community-detail","rating-stars","rating-body","rating-submit","community-review-list","rating-summary-live","account-save-nickname","rating-auth-hint","community-offline-message","nickname-bar"];
  for(const id of ids)assert.match(html,new RegExp('id="'+id+'"'),id+" is missing");
});
test("Supabase browser config has public key and Google OAuth stays disabled",()=>{
  assert.match(cfg,/https:\/\/slgfotvdellanbjcihlf\.supabase\.co/);
  assert.match(cfg,/publishableKey:\s*"sb_publishable_/);
  assert.match(cfg,/enableGoogleLogin:\s*false/);
  assert.match(community,/canSignIn\(\)/);
  assert.match(community,/probe\.error/);
  assert.match(html,/resong:open-song/);
  assert.match(html,/resong:close-song/);
});
test("database has account isolation policies and real rating aggregates",()=>{
  for(const word of ["enable row level security","members write their own reviews","members update their own reviews","members delete their own reviews","auth.uid()","reviews_one_per_user_song","song_rating_summary","reviews_user_id_fkey","check (rating between 1 and 5)"]){
    assert.ok(sql.includes(word),word+" is missing");
  }
  assert.ok(!sql.includes("raw_user_meta_data->>'name'"),"Google real name must not be copied publicly");
});
test("collector only allows well-formed MusicBrainz catalog entries",()=>{
  const items=mapper([
    {id:"72bd09c1-b945-40d4-8797-86b7c49a5e1f",title:"First",artist:"Artist",release_date:"2026-10-16",country_code:"KR",country_name:"KR",video_id:"abcdefghijk"},
    {id:"72bd09c1-b945-40d4-8797-86b7c49a5e1f",title:"Duplicate",artist:"Artist",release_date:"2026-10-16",country_code:"KR"},
    {id:"some-invalid",title:"Bad",artist:"Artist",release_date:"2026-10-16",country_code:"KR"}
  ]);
  assert.equal(items.length,1);
  assert.equal(items[0].video_id,"abcdefghijk");
});
test("only real collected tracks populate the browse page",()=>{
  assert.ok(!html.includes("const tracks=["));
  assert.ok(!html.includes("musiclover"));
  assert.ok(html.includes("data/new-releases.json"));
  assert.ok(feed.items.length>0);
});
test("no server-only key included in frontend assets",()=>{
  assert.doesNotMatch(community,/service_role|SUPABASE_SERVICE_ROLE_KEY/);
  assert.doesNotMatch(cfg,/sb_secret_|eyJ[a-zA-Z0-9]{60,}/);
});
