"use strict";
const assert=require("node:assert/strict"),test=require("node:test"),fs=require("node:fs"),vm=require("node:vm");
const read=name=>fs.readFileSync(name,"utf8");
const html=read("index.html"),client=read("assets/js/community.js"),privacy=read("privacy.html"),terms=read("terms.html"),sql=read("supabase/migrations/20261016_self_service_account_deletion.sql");
test("homepage and client parse and contain privacy routes",()=>{
  new vm.Script(html.match(/<script>([\s\S]*?)<\/script>/)[1]);new vm.Script(client);
  for(const link of ['/privacy.html','/terms.html'])assert.ok(html.includes(link));
  for(const id of ["review-delete","account-delete","auth-signin","rating-submit","community-review-list"])assert.ok(html.includes('id="'+id+'"'));
});
test("privacy and terms pages explain OAuth, storage and deletion",()=>{
  for(const key of ["Google","Supabase","탈퇴","리뷰"])assert.ok(privacy.includes(key),key);
  for(const key of ["MusicBrainz","YouTube","계정","리뷰"])assert.ok(terms.includes(key),key);
  assert.ok(privacy.includes("문의 이메일은 운영자 확인 후 등록 예정"));
});
test("deletion is self-only, no arbitrary user argument, anonymous users blocked",()=>{
  assert.ok(sql.includes("actor := (select auth.uid())"));
  assert.ok(sql.includes("delete from auth.users where id = actor"));
  assert.ok(sql.includes("revoke all on function public.delete_my_account() from public, anon"));
  assert.ok(sql.includes("security invoker"));
  assert.ok(sql.includes("security definer"));
  assert.ok(!sql.includes("delete from auth.users;"));
  assert.ok(client.includes('db.rpc("delete_my_account")'));
  assert.ok(client.includes('word!=="탈퇴"'));
});
test("login is deliberately gated until operator contact and policy review",()=>{
  const sandbox={window:{}};vm.runInNewContext(read("config/public.js"),sandbox);
  assert.equal(sandbox.window.RESONG_PUBLIC_CONFIG.enableGoogleLogin,false);
  assert.ok(!client.includes("supabase.co/auth/v1/callback"));
});
