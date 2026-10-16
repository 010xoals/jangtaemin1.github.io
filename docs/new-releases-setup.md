# RE:SONG — 신곡 수집 및 YouTube 연동 관리

## 운영 방식
- GitHub Pages 공개 사이트는 main 브랜치 커밋 시 자동 배포됩니다.
- MusicBrainz에서 최근 7일 싱글 발매 그룹 일부 수집(전 세계 모든 발매곡을 보장하지 않음).
- 국가는 MusicBrainz 아티스트 country/area로 분류합니다. 실제 주요 활동 국가와 다를 수 있습니다.
- YouTube Data API 키는 GitHub Actions Secret YT_API_KEY에서만 읽습니다.
- 영상 제목·채널명 일치 + public/embeddable 확인, 그 결과 영상 ID를 저장합니다. **공식 영상이라는 보증은 없습니다.**
- 영상 미확인 곡은 외부 YouTube 검색 버튼을 제공합니다.
- 하루 최대 30건(필요 시 MAX_YOUTUBE_SEARCHES로 조정)까지 새 동영상 검색하며, 국가별로 균등 분산합니다.
- 검색 이력(video_checked_at)을 저장하여 24시간 내 실패 검색을 반복하지 않습니다.
- 이미 매칭된 영상 ID는 수집 데이터가 갱신되어도 유지됩니다. 영상 삭제·비공개 변경 등 검수 자동화는 추후 과제입니다.
- 매일 KST 오전 11:23 예약 실행되나 GitHub Actions 사정에 따라 지연될 수 있습니다.
- 빈 데이터, YouTube 인증 실패, 검색 API 할당량 초과 등은 GitHub Actions 로그에서 확인합니다.

## 영상 연결 백필 (관리자)
- 기본 작업: node scripts/update_new_releases.cjs
- 이미 수집된 신곡의 미연결 영상만 재확인: VIDEO_ONLY=1 MAX_YOUTUBE_SEARCHES=30 node scripts/update_new_releases.cjs
- 프론트엔드는 data/new-releases.json을 읽습니다. 브라우저에는 비밀 API 키가 전달되지 않습니다.
- 비용: YouTube Data API search.list는 요청당 100 quota units, 기본 일 10,000 units(프로젝트별 변동 가능). 너무 큰 검색 횟수는 권장하지 않습니다.
- 뮤직브레인즈 아티스트 이름에 여러 참여자가 합쳐진 곡, 커버/리믹스, 잘못된 외부 링크 등은 수동 검수가 필요합니다.

## 2026-10-16 실연동 검증
- MusicBrainz 수집: 67곡(한국 7 / 일본 20 / 미국 20 / 기타 20)
- 개발 브랜치 YouTube 매칭 테스트: 총 21곡 연결(기존 1곡 포함), 추가 검색 30건, 0건 API 오류
- 자동 매칭 결과의 곡·채널 일치 여부는 사람이 전수 검사한 상태가 아닙니다.
- 화면의 가상 평점/리뷰는 제거; 회원·공용 평점 데이터베이스는 다음 개발 단계입니다.

## 상업 운영 검토
- AdSense 수익화 전 MusicBrainz 서비스의 상업적 API 이용 조건과 메타데이터 라이선스를 확인하세요.
- 회원·광고 도입 전 개인정보처리방침과 서비스 정책이 필요합니다.
