# RE:SONG — 음악을 발견하는 공간

공개 사이트: https://www.jangtaemin1.com/

B안 PAPER STEREO 테마로 제작한 한국·일본·미국·그 외 국가별 신곡 정보 서비스입니다.

## 현재 기능
- MusicBrainz에 등록된 최근 7일 싱글 일부와 아티스트 국가 분류
- YouTube Data API 검색으로 일치 가능성이 높은 공개/임베드 영상 연결
- YouTube 영상 연결 곡 모아보기 및 신곡 검색, 원본 정보 링크
- GitHub Actions 매일 신곡 수집 및 영상 ID 자동 보강

## 다음 개발
- 실제 사용자 로그인, 공용 평점·리뷰 DB 및 집계
- 관리자 검수, 잘못된 동영상 수정·신고
- 검색/SEO, 라이선스·개인정보 정책, 광고 수익화

주의: 자동 YouTube 연결은 진짜 공식 영상임을 보증하지 않습니다. 현재 평점과 커뮤니티 기능은 준비 중입니다.

- 이전 사이트 백업: `backup/pre-resong-launch-2026-10-16`
- 배포 방식: GitHub Pages (main)에서 변경 후 자동 배포
- 상세 내용: docs/new-releases-setup.md

## 회원 시스템 (준비 완료 / DB 연결 대기)
- `supabase/migrations/20261016_community.sql`: 회원 닉네임·음악 카탈로그·곡별 평가 DB 및 RLS 보안 정책.
- `assets/js/community.js`: Google OAuth, 닉네임 수정, 실제 평점·리뷰 CRUD와 실시간 읽기(조회할 때 최신 데이터).
- `config/public.js`: Supabase 공개 프로젝트 URL 및 publishable/anon key 자리. **값이 비어 있으면 로그인 버튼 비활성화.**
- `scripts/sync_supabase_catalog.cjs`: GitHub Actions에서 신곡 데이터 DB 자동 동기화(Secrets가 등록된 경우에만 실행).
- `docs/supabase-setup.md`: 실제 프로젝트 연결/승인 후 필요한 단계 및 수동 QA.
- `tests/community.test.cjs`: 브라우저와 DB 정책 간 계약 테스트.

**현재 상태:** 공개 홈페이지에는 연동을 위한 코드만 추가됨. Supabase DB에 SQL 실행, Google OAuth 대시보드 설정, 서비스 정책 정비는 아직 미완료이므로 실제 사용자 로그인·리뷰 저장은 오픈되지 않았음.

## 실제 Supabase 프로젝트 연결
- 서울 `RESONG` 프로젝트 생성 완료; UUID `slgfotvdellanbjcihlf`.
- 테이블 `songs`에 신곡 67곡 저장, 보안 경고 0건.
- 클라이언트 공개키 및 프로젝트 URL 반영. 실제 익명 조회 가능 상태로 배포 예정.
- Google OAuth 아직 미설정 → `enableGoogleLogin: false`; 로그인/리뷰 쓰기 비활성화.
- 신곡의 정기 DB 동기화는 GitHub Secrets `SUPABASE_URL`과 `SUPABASE_SERVICE_ROLE_KEY` 추가 후 자동 작동.
