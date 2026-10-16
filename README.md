# RE:SONG

공개 주소: https://www.jangtaemin1.com/

B안 PAPER STEREO 음악 리뷰 홈페이지. 소스코드를 main 브랜치에 커밋하면 GitHub Pages가 자동으로 다시 배포합니다.

## 현황
- 최근 7일 신규 싱글 정보: MusicBrainz 기반, 국가별 분류(한국/일본/미국/그 외)
- YouTube Data API v3로 확인한 공개 임베드 영상만 연결
- 별점/리뷰 시연 화면은 이 브라우저에만 저장됨(회원·공용 DB 개발 예정)
- YouTube 검색 키는 GitHub Actions Secret YT_API_KEY에 보관
- GitHub Actions에서 수집 파일 data/new-releases.json을 매일 갱신

## 주의
- 음악 데이터는 전체 신곡이 아닌 일부이고 국가·영상 자동매칭이 부정확할 수 있음.
- AdSense는 아직 미연결. 예전 ads.txt의 가짜 pub-000... 번호는 제거함.
- 이전 사이트 백업: backup/pre-resong-launch-2026-10-16
