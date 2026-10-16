# RE:SONG Supabase 회원·평점·리뷰 구축 가이드

## 단계별 상태
- [x] DB 마이그레이션(SQL) 작성
- [x] RLS(회원 본인만 리뷰 작성·수정·삭제) 설계
- [x] 공개용 Google 로그인 UI와 실제 평점/리뷰 조회·저장 코드 작성
- [x] GitHub Actions에서 신규 MusicBrainz 곡을 DB에 동기화할 백엔드 스크립트
- [x] Supabase 서울 `RESONG` 프로젝트 생성 및 SQL 실행 / 보안 경고 0건
- [ ] Supabase Google OAuth 활성화 및 허용 Redirect URL 설정
- [x] 공개용 설정 파일에 프로젝트 URL 및 `sb_publishable_...` 반영 (Google 로그인은 명시적으로 비활성화)
- [ ] GitHub Actions Secret `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` 추가 (자동 최신곡 DB 동기화)
- [ ] 서로 다른 두 테스트 회원으로 실제 저장/평균/권한 테스트
- [ ] 개인정보처리방침·이용약관·문의 채널 정비 후 회원 기능 공개

## 1. 데이터베이스 (Supabase 관리자 연결 필요)
Supabase 프로젝트의 SQL Editor에서 다음 마이그레이션을 실행:
`supabase/migrations/20261016_community.sql`

주요 데이터 구조:
- `public.songs`: MusicBrainz 곡 ID(UUID), 곡명, 아티스트, 국가, 발매일, 영상 ID.
- `public.profiles`: 공개 닉네임(기본값 `음악 친구`), 로그인 회원 UUID. 이메일·Google 실명은 수집하지 않음.
- `public.reviews`: 곡당 회원별 평점(1~5) + 최대 1,500자 리뷰 + 등록/수정 시각.
- `public.song_rating_summary`: 실제 리뷰에 기반한 평균·평가자 수(SECURITY INVOKER).
- 곡 데이터 삽입·수정 권한은 서비스 역할 키를 쓰는 서버 측 실행에만 부여.
- 모든 테이블 RLS 활성화. 일반 회원은 자신의 리뷰·닉네임만 변경 가능.

마이그레이션 전에 반드시 프로젝트 백업/복원 정책을 확인하세요.

## 2. Google 로그인 (Supabase 대시보드 설정 필요)
- Authentication > Providers > Google을 활성화하고 Google Cloud OAuth 클라이언트를 연결.
- Google OAuth Console의 승인된 redirect URI: `https://<PROJECT_REF>.supabase.co/auth/v1/callback`
- Supabase Authentication > URL Configuration > Site URL: `https://www.jangtaemin1.com/`
- Allowed Redirect URLs에 `https://www.jangtaemin1.com/**` 추가(실운영에서는 가능한 좁은 경로로 제한).
- Google OAuth 클라이언트 secret은 Supabase 대시보드에만 넣고 GitHub/public JS에 넣지 않습니다.
- OAuth 제공자·앱 확인 및 동의 화면을 먼저 설정하세요.

## 3. 공개용 클라이언트 환경 값
`config/public.js` 파일의 `url`에는 Supabase Project URL,
`publishableKey`에는 publishable/anon key를 입력합니다.

이 값은 웹브라우저가 읽는 **공개용** 값입니다.
- `service_role` 또는 `sb_secret_...` 키는 이 파일에 절대 넣지 마세요.
- 프로젝트 미설정 시 두 값은 빈 문자열로 유지되며 **Google 로그인 버튼은 비활성화**됩니다.
- SQL/권한 정책·개인정보처리방침 준비 후 공개 클라이언트 값을 반영하세요.

## 4. GitHub Actions 서버 비밀키 설정
Repo Settings > Secrets and variables > Actions:
- `SUPABASE_URL` = Supabase Project URL
- `SUPABASE_SERVICE_ROLE_KEY` = Supabase service_role (서버 전용 JWT)
- 기존 `YT_API_KEY` 유지.

`.github/workflows/update_new_releases.yml`의 자동 실행은 신곡을 수집한 뒤
`node scripts/sync_supabase_catalog.cjs`를 조건부 실행합니다.
비밀키 두 개가 없으면 DB 동기화를 건너뛰고 현재 사이트의 신곡 감상은 계속 운영됩니다.
원본 `data/new-releases.json`을 DB에 upsert하며, 기존 회원 평점은 삭제하지 않습니다.

## 5. 정식 오픈 전 최소 QA
1. 익명 사용자는 곡/평균/리뷰 조회 가능하며 로그인 없이 작성·수정 불가.
2. 구글 A 계정으로 리뷰 작성 → 브라우저 변경 후에도 유지.
3. 구글 B 계정으로 같은 곡 평가 → rating_count=2, average_rating 재계산.
4. A 계정은 B의 리뷰 수정·삭제 불가. A 자신의 리뷰 재작성 시 중복 행 없음.
5. 가입 시 Google 실명을 공개하지 않고 닉네임 `음악 친구` 사용.
6. 검증된 MusicBrainz 곡 UUID만 리뷰 대상이 됨(FK).
7. 익명/인증 사용자에게 DB service_role 키가 절대 노출되지 않음.
8. YouTube·MusicBrainz 수집/배포가 회원 기능 문제로 중단되지 않음.

## 사업·정책 참고
- 회원 정보와 Google OAuth를 도입하기 전 개인정보처리방침, 이용약관, 신고/삭제 요청 통로를 마련해야 합니다.
- 리뷰 스팸/신고/관리자 기능은 아직 후속 과제이며, 서비스 공개 전 검토가 필요합니다.
- MusicBrainz 상업적 API 이용 조건 및 YouTube API 서비스 약관 준수 검토 필요.

## 2026-10-16 실제 연결 기록
- Project ref: `slgfotvdellanbjcihlf`, Seoul (`ap-northeast-2`), Free plan (project creation $0/month)
- 실제 곡 67개, 그중 YouTube 영상 21개 연결
- 회원 0명 / 실제 리뷰 0개: 회원기능 오픈 전의 정상 상태
- RLS 경고 2건은 `restrict_trigger_function_exec` 마이그레이션을 적용해 0건으로 해소
- `enableGoogleLogin: false`인 동안 실제 DB 조회는 가능하지만 Google 가입·평가 저장은 비활성화함
- Google OAuth 설정·개인정보처리방침 및 자동 DB 동기화 비밀키 설치 전에는 `enableGoogleLogin`을 true로 변경하지 말 것
