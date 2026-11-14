# 로컬·운영 데이터 및 배포 일치 기준

## 개발 위치

개인 저장소 gxmzung/forest-front-wildfire의 작업 브랜치에서 개발·검증한다. 회사 운영 반영은 검토 후 sonjh-github/forest-front-wildfire로 동일 변경을 전달한다. 개인 저장소 push로 운영 서버를 배포하지 않는다.

## 같은 데이터의 의미

- 업무 API와 대시보드 API 모두 https://api.forest.tobeunicorn.kr 을 기본값으로 사용한다.
- 같은 사건 ID·권한·필터·관측시각·데이터 출처로 비교한다. 실시간 값은 조회시각에 따라 바뀌므로 숫자가 영구히 같다고 보장하지 않는다.
- API 실패는 오류·수신 중단으로 표시한다. 실제 데이터가 없는 값을 모사 데이터로 자동 대체하지 않는다.
- 실데이터 검증 URL에는 demo=1, e2e=1, field=1, preview=1을 붙이지 않는다.
- .env.local, 셸 환경변수와 Docker build-arg는 공통 설정을 덮어쓸 수 있다. 검증 전에 모두 확인한다. 서버 인증키는 프론트 VITE 변수에 넣지 않는다.

## 로컬에서 배포 이미지 실행

Docker 사용이 가능한 노트북에서 저장소 루트 기준으로 실행한다.

```powershell
npm ci
npm run check:parity
npm test
npm run build
docker compose -f compose.production-check.yml up --build -d
```

http://127.0.0.1:15173/ 에서 확인한다. 이 경로는 배포와 동일한 Dockerfile 및 컨테이너 Nginx를 사용한다. 종료는 docker compose -f compose.production-check.yml down 으로 한다.

## 배포 전 확인 항목

1. 브라우저 Network에서 두 API가 회사 HTTPS 주소를 쓰는지 확인한다.
2. 실제 사건·장비 ID·관측시각·출처를 운영 화면과 비교한다. API 호출 실패·인증 실패를 분리한다.
3. 로컬 Origin의 CORS 허용과 X-Origin 헤더 preflight를 확인한다. CORS 오류를 피하려고 인증·브라우저 보안을 끄지 않는다.
4. 지도 WebGL·타일, 실제 HLS 영상, WebSocket, CSP, HTTPS 혼합 콘텐츠를 확인한다. 빌드 통과나 /health 성공만으로 화면 검증 완료 처리하지 않는다.
5. GNSS·릴레이·LED는 노트북의 현장 프로그램과 별도 연결한다. 서버 health 성공을 장치 실물 연결 성공으로 표시하지 않는다.
6. 회사 저장소에 같은 변경을 반영한 뒤 검증된 정확한 커밋을 배포한다. 배포 후 화면·데이터 경로를 다시 확인한다.

## 현재 증빙과 한계

초기 변경은 API 기본값·공통 설정·Docker 로컬 실행 절차와 배포 원본 일치를 위한 기반 작업이다. 새로운 기상 API·릴레이·GNSS 기능 구현 완료를 의미하지 않는다. 실행 환경에 Docker가 없으면 컨테이너 검증을 수행하지 못했다고 명시한다. 실제 서버 CORS·인증·장치 연결은 각각 검증 결과를 남긴다.

2026-11-14 이 작업 환경에서 회사 API의 /api/v1/events?limit=1 GET 및 로컬 Origin OPTIONS 요청은 HTTP 404를 반환했다. 원인을 서버 라우팅·공개 경로·접근 조건 중 하나로 확정하지 않았으며, 실제 데이터 연결·CORS 통과로 판정하지 않는다. 이 환경에는 Docker가 없어 컨테이너 실행 검증은 미실행이다.
