# 산림재난 통합관제 프론트엔드 SW 등록 자료

## 등록 대상

- 프로젝트명: 산림재난 통합관제 프론트엔드
- 프로그램 개요: 산불·산사태 사건, 현장 자원, 검증된 드론 텔레메트리, 통신 상태, 경보와 KPI 근거를 지도 중심으로 표시하는 React 웹 애플리케이션
- 등록 기준 브랜치: `fix/sw-registration-final-20261012`
- 기준 소스: `upstream/main@0c48440434f1bda50d9f8a0300b553e89770dd28`에서 분기
- 등록 커밋: PR 생성 시 확정한 HEAD SHA를 제출 매니페스트에 기록

현장 장비의 측정 정확성, 운영 서버의 가용성, 실제 원시로그 증빙은 이 프론트엔드 빌드만으로 입증되지 않는다. Core가 제공하지 않거나 검증하지 않은 값은 미수신·미연결·확인 불가 또는 미검증으로 표시한다.

## URL과 데이터 모드

| URL | 용도 | 데이터 원칙 |
|---|---|---|
| `/` | 운영 관제 | Core API와 검증된 GCS/MAVLink 텔레메트리만 표시 |
| `/?live=1` | 운영 URL 호환 | `/`와 같은 운영 데이터 정책 |
| `/?demo=1&scenario=WILDFIRE` | 복합 시연 | 명시적인 DEMO 표식, 공식 KPI PASS 차단 |
| `/?field=1&preview=1` | 현장 UI 미리보기 | 명시적인 preview 데이터, 운영 경로와 분리 |
| `/device` | 장비 관리 | 장비 등록·조회 UI |

## 주요 소스 구성

- `src/features/disaster-dashboard/`: 통합 관제 화면, 지도, KPI 증빙 판정, 텔레메트리 상태와 DEMO/운영 모드 분리
- `src/http-api/`: Core API, 드론 twin, 외부 연계, FieldLink와 장비 관리 API 어댑터
- `src/pages/device/`: 장비 관리 화면
- `src/shared/`: 공통 라우팅과 유틸리티
- `docs/`: 운영 준비·장비 등록·등록 제출 문서
- `.github/workflows/`: PR 검증 및 main 병합 후 배포 작업. 이번 등록 준비에서는 실행·변경하지 않음

## 실행 환경과 방법

- Node.js/npm 환경
- 의존성 설치: `npm ci`
- 개발 확인: `npm run dev`
- 자동 테스트: `npm test -- --run`
- 프로덕션 빌드: `npm run build`

API 주소는 `VITE_API_BASE_URL`, 대시보드 API 주소는 `VITE_DASHBOARD_API_BASE_URL`, 실시간 스트림은 `VITE_TELEMETRY_WS_URL`로 주입한다. 제출본에는 `.env`, 토큰, 비밀번호, API 키, `node_modules`, 빌드 산출물을 포함하지 않는다.

## 화면 캡처 대상

1. `/`: API 정상 연결 시 검증된 운영 자산, API 미연결 시 미연결/확인 불가 표시
2. `/?live=1`: `/`와 동일한 운영 정책
3. `/?demo=1&scenario=WILDFIRE`: DEMO 배지와 복합 시연 기능, 공식 PASS가 아닌 KPI 상태
4. `/?field=1&preview=1`: 현장 미리보기 표식
5. `/device`: 장비 관리 목록과 상세 화면

운영 API 및 실제 장비 연결 화면은 별도 승인된 환경에서 캡처한다. 등록용 캡처를 만들기 위해 임의 좌표나 측정값을 생성하지 않는다.

## 제출본 체크리스트

- [ ] PR 검토가 끝난 정확한 커밋 SHA를 기록
- [ ] `npm ci`, 전체 테스트, TypeScript/Vite 빌드, `git diff --check` 결과 첨부
- [ ] 운영/DEMO/preview URL별 캡처와 데이터 출처 표기
- [ ] `.env*`, 인증정보, 개인키, 로그 원문, `node_modules`, `dist` 제외
- [ ] Git 추적 소스, `package.json`, lockfile, README와 필요한 문서 포함
- [ ] 실장비·Core API·WebSocket 운영 검증 미완료 항목을 별도 명시
- [ ] 승인 전 main 병합·운영 배포 금지
