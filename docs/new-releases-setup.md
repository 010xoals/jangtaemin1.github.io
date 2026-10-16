# RE:SONG 최근 7일 신곡 수집과 YouTube 연결

## 구현
- 수집: MusicBrainz Release Group Search(지난 7일 싱글) → Artist Lookup(국가) → data/new-releases.json
- 영상: YouTube Data API v3 검색 후 공개/임베드 허용 영상만 video_id 저장. 일치하지 않으면 검색 링크만 제공.
- API 키는 브라우저 코드에 절대 넣지 않고 GitHub Actions Secret에서만 사용.
- 지금 저장된 피드는 빈 목록이며 자동 수집 실행 전에는 실제 최신곡 표시를 하지 않음.

## 설정 및 실행
1. Google Cloud Console에서 YouTube Data API v3 활성화 후 API 키 발급.
2. GitHub 저장소 Settings → Secrets and variables → Actions → New repository secret 에 YT_API_KEY 등록(기존 키가 있으면 재사용).
3. 이 브랜치가 main에 병합된 다음 GitHub Actions → Update RE:SONG New Releases → Run workflow 실행. 예약 실행은 기본 브랜치에서만 동작.
4. Actions 성공 후 data/new-releases.json의 generated_at, items, video_id 확인.
5. 필요하면 Node.js 20+에서 node scripts/update_new_releases.cjs 명령으로 로컬 수동 실행 가능.

## 데이터와 정확도
- JSON 형태: {generated_at,range:{start,end},source,country_basis,items:[{id,title,artist,release_date,country_code,country_name,source_url,video_id}]}
- 국가: 아티스트의 MusicBrainz country/area를 주요 활동 국가의 대리값으로 사용. 정확한 활동 국가와 다를 수 있음.
- 국가 미확인 곡은 제외. 아티스트 국가를 발매 지역으로 대체하지 않음.
- MusicBrainz에 입력된 싱글 발매 그룹 중 일부(최대 3페이지, 국가당 20곡). 앨범 수록곡이나 늦게 등록된 곡은 누락 가능.
- 자동 선택된 YouTube 결과는 공식 음원/공식 뮤직비디오임을 보증하지 않음. 실제 채널·곡명 확인 필요.
- YouTube API 키가 없거나 후보가 없으면 영상 iframe을 넣지 않음. 대신 YouTube 검색 링크 안내.
- 수집 대상 후보 중 새 YouTube 검색은 실행당 최대 12회. 기존 확인 ID 재사용.
- GitHub Actions 예약 워크플로는 main 병합 전에는 운영 중이 아님.

## 안전
- GitHub 비밀키는 채팅이나 공개 저장소에 공유하지 말 것.
- MusicBrainz API 호출 간격 1.15초 및 제한적 재시도.
- 브라우저는 서버가 미리 생성한 JSON만 읽으며 API 키는 전달받지 않음.
