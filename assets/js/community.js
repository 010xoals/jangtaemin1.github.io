/**
 * RE:SONG real member ratings/reviews.
 * Loaded independently: missing Supabase config NEVER breaks new-release browsing.
 * The publishable key is public; server service-role must stay in GitHub Secrets.
 */
const $=s=>document.querySelector(s);
const msg=$("#community-message");
const loginBtn=$("#auth-signin");
const signOutBtn=$("#auth-signout");
const profileBar=$("#account-controls");
const displayLabel=$("#account-name");
const nicknameInput=$("#account-nickname");
const communitySection=$("#community-detail");
const stars=$("#rating-stars");
const bodyInput=$("#rating-body");
const submitBtn=$("#rating-submit");
const reviewList=$("#community-review-list");
const ratingSummary=$("#rating-summary-live");
const nicknameBtn=$("#account-save-nickname");
let db=null,member=null,song=null,currentRating=0,ownReview=null,loadSerial=0;
const canSignIn=()=>window.RESONG_PUBLIC_CONFIG?.enableGoogleLogin===true;

function status(text){msg.textContent=text}
function textEl(tag,content,className){
  const x=document.createElement(tag);x.textContent=content;
  if(className)x.className=className;
  return x;
}
function reviewStars(score){
  return "★".repeat(score)+"☆".repeat(5-score);
}
function resetVisible(){
  reviewList.replaceChildren(textEl("p","곡을 선택하면 실제 회원 리뷰를 조회합니다.","muted small"));
  ratingSummary.textContent="평가 내역 불러오기 전";
  bodyInput.value=""; currentRating=0;ownReview=null;paintStars();
}
function paintStars(){
  for(const el of stars.querySelectorAll("[data-rating]")){
    const number=Number(el.dataset.rating);
    el.classList.toggle("active",number<=currentRating);
    el.setAttribute("aria-pressed",String(number===currentRating));
  }
}
function authUI(){
  const signed=Boolean(member);
  loginBtn.hidden=signed;
  loginBtn.textContent=canSignIn()?"Google 로그인":"로그인 준비 중";
  loginBtn.disabled=!db||!canSignIn();
  profileBar.hidden=!signed;
  $("#nickname-bar").hidden=!signed;
  displayLabel.textContent=signed?"로그인됨":"";
  bodyInput.disabled=!signed||!canSignIn();
  submitBtn.disabled=!signed||!canSignIn();
  const hint=$("#rating-auth-hint");
  hint.textContent=!canSignIn()?"Google 로그인 연결 후 리뷰 작성이 가능합니다.":signed?"내 평점을 선택한 후 리뷰를 남겨보세요.":"Google 로그인 후 나의 별점과 리뷰를 등록할 수 있어요.";
}
async function refreshAccount(){
  if(!db)return;
  const {data,error}=await db.auth.getUser();
  if(error){status("로그인 상태를 확인하지 못했습니다.");return}
  member=data.user;
  authUI();
  if(member){
    const {data:p}=await db.from("profiles").select("display_name").eq("id",member.id).maybeSingle();
    displayLabel.textContent=p?.display_name||"음악 친구";
    nicknameInput.value=p?.display_name||"음악 친구";
  }
  if(song)await loadReviews(song);
}
function presentReview(record){
  const art=document.createElement("article");art.className="community-review";
  const userName=record.profiles?.display_name||"음악 친구";
  const first=document.createElement("div");first.className="community-review-top";
  first.append(textEl("strong",userName),textEl("span",reviewStars(record.rating),"rating"));
  const note=textEl("p",record.body||"별점 평가만 남겼습니다.","small");
  const timestamp=textEl("span",new Date(record.created_at).toLocaleDateString("ko-KR"),"muted small");
  art.append(first,note,timestamp);
  return art;
}
async function loadReviews(selected){
  if(!db||!selected)return;
  const serial=++loadSerial;
  const id=selected.id;
  ratingSummary.textContent="실제 평가를 불러오는 중…";
  reviewList.replaceChildren(textEl("p","리뷰를 불러오는 중입니다.","muted small"));
  const [summaryRes,reviewsRes]=await Promise.all([
    db.from("song_rating_summary").select("rating_count,average_rating").eq("song_id",id).maybeSingle(),
    db.from("reviews").select("id,user_id,rating,body,created_at,profiles!reviews_user_id_fkey(display_name)").eq("song_id",id).order("created_at",{ascending:false}).limit(30)
  ]);
  if(serial!==loadSerial||song?.id!==id)return;
  if(summaryRes.error||reviewsRes.error){
    ratingSummary.textContent="DB 연결 또는 조회 권한을 확인해 주세요.";
    reviewList.replaceChildren(textEl("p","리뷰 조회에 실패했습니다.","muted small"));
    return;
  }
  const count=summaryRes.data?.rating_count||0;
  ratingSummary.textContent=count?("실제 회원 평가 "+count+"명 · 평균 "+Number(summaryRes.data.average_rating).toFixed(2)+"/5"):"아직 평가가 없습니다. 첫 리뷰를 남겨주세요.";
  const records=reviewsRes.data||[];
  reviewList.replaceChildren(...(records.length?records.map(presentReview):[textEl("p","등록된 회원 리뷰가 없습니다.","muted small")]));
  ownReview=member?records.find(x=>x.user_id===member.id)||null:null;
  if(member){
    // A user may have a review outside the first 30; look it up privately in that case.
    if(!ownReview){
      const {data}=await db.from("reviews").select("id,user_id,rating,body").eq("user_id",member.id).eq("song_id",id).maybeSingle();
      if(serial!==loadSerial||song?.id!==id)return;
      ownReview=data;
    }
    currentRating=ownReview?.rating||0;
    bodyInput.value=ownReview?.body||"";
  }else{currentRating=0;bodyInput.value=""}
  paintStars();
}
async function saveReview(){
  if(!db||!member||!song||!canSignIn())return status("현재 평점 작성 기능은 아직 오픈 전입니다.");
  if(currentRating<1||currentRating>5)return status("별점 1~5개를 선택해 주세요.");
  if(bodyInput.value.length>1500)return status("리뷰는 1,500자 이내로 작성해 주세요.");
  submitBtn.disabled=true;status("평가 저장 중…");
  const changed={rating:currentRating,body:bodyInput.value.trim()};
  const write=ownReview
    ? db.from("reviews").update(changed).eq("id",ownReview.id).eq("user_id",member.id)
    : db.from("reviews").insert({song_id:song.id,user_id:member.id,...changed});
  const {error}=await write;
  submitBtn.disabled=false;
  if(error){
    const isMissingSong=error.code==="23503";
    status(isMissingSong?"아직 DB에 등록되지 않은 음악입니다. 다음 데이터 동기화를 기다려 주세요.":"저장에 실패했습니다. 로그인 및 DB 정책을 확인해 주세요.");
    return;
  }
  status("나의 평가를 저장했습니다.");
  await loadReviews(song);
}
async function saveNickname(){
  if(!db||!member||!canSignIn())return;
  const name=nicknameInput.value.trim();
  if(!name||name.length>40)return status("닉네임은 1~40자로 입력해 주세요.");
  nicknameBtn.disabled=true;
  const {error}=await db.from("profiles").update({display_name:name}).eq("id",member.id);
  nicknameBtn.disabled=false;
  if(error){status("닉네임 변경에 실패했습니다.");return}
  displayLabel.textContent=name;
  status("닉네임을 변경했습니다.");
  if(song)await loadReviews(song);
}
function revealSong(detail){
  if(!detail?.id||!/^[0-9a-f-]{36}$/i.test(detail.id))return;
  song=detail; resetVisible();
  if(db){communitySection.hidden=false;$("#community-offline-message").hidden=true;loadReviews(song)}
  else{communitySection.hidden=true;$("#community-offline-message").hidden=false}
}
window.addEventListener("resong:open-song",e=>revealSong(e.detail));
window.addEventListener("resong:close-song",()=>{song=null;loadSerial++});
stars.addEventListener("click",e=>{const b=e.target.closest("[data-rating]");if(!b||!member)return;currentRating=Number(b.dataset.rating);paintStars()});
submitBtn.addEventListener("click",saveReview);
nicknameBtn.addEventListener("click",saveNickname);
loginBtn.addEventListener("click",async()=>{
  if(!db||!canSignIn())return;
  loginBtn.disabled=true;
  const {error}=await db.auth.signInWithOAuth({provider:"google",options:{redirectTo:location.origin+"/"}});
  if(error){status("Google 로그인을 시작하지 못했습니다.");loginBtn.disabled=false}
});
signOutBtn.addEventListener("click",async()=>{
  if(!db)return;
  const {error}=await db.auth.signOut();
  if(error)status("로그아웃에 실패했습니다.");
  else {member=null;status("로그아웃했습니다.");authUI();if(song)await loadReviews(song)}
});
async function init(){
  authUI();
  const cfg=window.RESONG_PUBLIC_CONFIG;
  if(!cfg?.url||!cfg?.publishableKey){
    status("회원 평가 서비스는 DB 연결 준비 중입니다. 신곡 감상은 로그인 없이 이용할 수 있습니다.");
    loginBtn.disabled=true;
    communitySection.hidden=true;
    return;
  }
  let origin;
  try{origin=new URL(cfg.url)}catch{status("회원 DB 주소 설정이 잘못되었습니다.");return}
  if(origin.protocol!=="https:"||!origin.hostname.endsWith(".supabase.co")||typeof cfg.publishableKey!=="string"){
    status("회원 DB 설정이 유효하지 않습니다.");return;
  }
  try{
    const {createClient}=await import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm");
    db=createClient(origin.origin,cfg.publishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
    $("#community-offline-message").hidden=true;
    loginBtn.disabled=!canSignIn();
    db.auth.onAuthStateChange((_event,_session)=>{
      // The Supabase auth callback must not synchronously call another auth method.
      setTimeout(()=>{refreshAccount().catch(()=>status("로그인 확인에 실패했습니다."));},0);
    });
    await refreshAccount();
    status(canSignIn()?"회원 평가 서비스가 연결되었습니다.":"실제 평점 DB가 연결되었습니다. Google 로그인은 준비 중이며 신곡 감상과 실제 평가 조회는 가능합니다.");
  }catch(e){
    db=null;loginBtn.disabled=true;communitySection.hidden=true;$("#community-offline-message").hidden=false;
    status("회원 평가 모듈을 불러오지 못했습니다. 신곡 감상은 계속 이용할 수 있습니다.");
  }
}
init();
