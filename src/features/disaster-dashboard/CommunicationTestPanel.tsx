import { subscribeVehicleWeatherTarget } from './vehicleWeatherTarget';
import { useEffect, useRef, useState } from 'react';
import { communicationLabels, communicationStates, communicationTransports, parseCommunicationTests, type CommunicationTestData } from './communicationTestData';

const BASE = 'http://127.0.0.1:18892';
const outputLabel = (value?: string) => ({ NOT_CONFIGURED: '장치 설정 대기', SENDING: '전송 중', ACKNOWLEDGED: '드라이버 적용 응답 수신', DELIVERY_ERROR: '장치 전송 오류' }[value ?? ''] ?? '연결 대기');
const gatewayState = (state: string) => ({ RECEIVED: '수신', STALE: '갱신 지연', BLOCKED: '실장비 입력 아님', ERROR: '연결 확인', WAITING: '수신 대기' }[state] ?? '미설정');
const linkState = (state: string) => ({ CONNECTED_REPORTED: '연결 보고', DISCONNECTED_REPORTED: '단절 보고', API_ERROR: '관리 API 오류', STALE: '이전 수신값', UNKNOWN: '미확인' }[state] ?? '미확인');
const legacyLabel = (type: string) => ({ LTE_5G: 'LTE·5G 통합', LPWA: 'LPWA(LoRa 구분 전)', LEO: '저궤도 위성', WIFI: 'Wi-Fi', TVWS: 'TVWS', ETHERNET: '이더넷' }[type] ?? type);
const metric = (value: number | null, unit: string) => value === null ? '미수신' : `${value.toLocaleString('ko-KR', { maximumFractionDigits: 2 })}${unit}`;
export function CommunicationTestPanel() {
  const local = typeof window !== 'undefined' && ['localhost', '127.0.0.1'].includes(window.location.hostname);
  const [token, setToken] = useState(''); const [session, setSession] = useState('');
  const [data, setData] = useState<CommunicationTestData | null>(null); const [error, setError] = useState('');
  const [pending, setPending] = useState(false); const generation = useRef(0);
  useEffect(() => {
    if (!session || !local) return;
    const controller = new AbortController(); let timer: ReturnType<typeof setTimeout>; const current = ++generation.current;
    const poll = async () => {
      try {
        const response = await fetch(`${BASE}/tests`, { headers: { Authorization: `Bearer ${session}` }, signal: AbortSignal.any([controller.signal, AbortSignal.timeout(3000)]), cache: 'no-store' });
        if (!response.ok) throw Error(String(response.status));
        const result = parseCommunicationTests(await response.json());
        if (generation.current === current && !controller.signal.aborted) { setData(result); setError(''); }
      } catch { if (generation.current === current && !controller.signal.aborted) { setData(null); setError('로컬 시험 서버 연결을 확인하세요. 마지막 결과로 현재 성공을 판정하지 않습니다.'); } }
      if (!controller.signal.aborted) timer = setTimeout(poll, 1000);
    };
    void poll(); return () => { controller.abort(); clearTimeout(timer); ++generation.current; };
  }, [session, local]);
  const [vehicleError, setVehicleError] = useState('');
  useEffect(() => {
    if (!session || !local || !data?.vehicle?.enabled) return;
    const controller = new AbortController();
    const unsubscribe = subscribeVehicleWeatherTarget((target) => {
      void fetch(`${BASE}/vehicle/weather-target`, { method: 'POST', headers: { Authorization: `Bearer ${session}`, 'Content-Type': 'application/json' }, body: JSON.stringify(target), signal: AbortSignal.any([controller.signal, AbortSignal.timeout(3000)]) })
        .then((response) => { if (!response.ok) throw Error(); if (!controller.signal.aborted) setVehicleError(''); })
        .catch(() => { if (!controller.signal.aborted) setVehicleError('차량 기상 조회 위치 전달 실패'); });
    });
    return () => { unsubscribe(); controller.abort(); };
  }, [session, local, data?.vehicle?.enabled]);
  async function command(path: string, body: object) {
    setPending(true);
    try {
      const response = await fetch(`${BASE}${path}`, { method: 'POST', headers: { Authorization: `Bearer ${session}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(5000) });
      if (!response.ok) throw Error(String(response.status)); setError('');
    } catch { setError('시험 요청 실패 · 드라이버 설정과 실행 중인 시험을 확인하세요.'); }
    finally { setPending(false); }
  }
  const selected = data?.tests.find((r) => r.id === data.selectedRunId);
  return <section className="environment-data-panel communication-test-panel" aria-label="통신 종류별 실장비 시험">
    <header><strong>통신 종류별 시험</strong><span className="communication-server-status" data-connected={Boolean(data)}>{data ? '로컬 시험 서버 연결' : '연결 대기'}</span></header>
    <div className="communication-selection"><span>선택 시험 <b>{selected ? communicationLabels[selected.transport] : '없음'}</b></span><span>경광봉 요청 <b>{data?.vehicle?.manual ? '수동 제어 중' : data ? ({ GREEN: '초록', RED: '빨강', OFF: '소등' }[data.baton.color]) : '연결 대기'}</b></span></div>
    {vehicleError && <p className="data-warning" role="status">{vehicleError}</p>}
    {data?.vehicle?.enabled && <p className="communication-output-status">차량 음성 {({ READY: '준비', PLAYING: '재생 중', PLAYBACK_ERROR: '재생 확인 필요', NOT_CONFIGURED: '설정 대기' }[data.vehicle.audio] ?? '확인 중')} · 기상 전광판 {outputLabel(data.vehicle.led)}{data.vehicle.manual ? ' · 수동 출력 시험 중' : ''}</p>}
    {error && <p className="data-warning" role="status">{error}</p>}
    <dl className="communication-test-grid">{communicationTransports.map((transport) => {
      const row = data?.tests.find((t) => t.transport === transport);
      return <div key={transport} data-test-state={row?.state ?? 'UNTESTED'}><dt>{communicationLabels[transport]}</dt><dd>{row ? communicationStates[row.state] : session ? '결과 미수신' : '미시험'}</dd>
        {row?.evidence && <small>수신 {row.evidence.received}/{row.evidence.sent}{row.evidence.latencyMs != null ? ` · ${row.evidence.latencyMs}ms` : ''}</small>}
        {data?.configured.includes(transport) && <button type="button" disabled={pending || data?.vehicle?.manual || row?.state === 'RUNNING'} onClick={() => void command('/tests/run', { transport })}>시험 실행</button>}
        {row?.id && <button type="button" aria-label={`${communicationLabels[transport]} 시험을 경광봉 표시 대상으로 선택`} disabled={pending || data?.vehicle?.manual || data?.selectedRunId === row.id} onClick={() => void command('/tests/select', { runId: row.id })}>{data?.selectedRunId === row.id ? '표시 중' : '경광봉 선택'}</button>}
      </div>;
    })}</dl>
    <p className="communication-output-status">경광봉 출력 <strong>{outputLabel(data?.outputs.relay)}</strong></p>
    {data?.gateway && data.gateway.state !== 'NOT_CONFIGURED' && <details className="operational-disclosure"><summary>기존 게이트웨이 수신 · {gatewayState(data.gateway.state)}</summary>
      {data.gateway.observedAt && <p>수집 시각: {new Date(data.gateway.observedAt).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })} KST</p>}
      <dl>{data.gateway.links.map((link) => <div key={link.type}><dt>{legacyLabel(link.type)}</dt><dd>{linkState(link.state)}</dd>
        <p>지연 {metric(link.latencyMs, 'ms')} · 손실 {metric(link.packetLossPct, '%')}</p>
        <p>신호 {metric(link.signalStrengthDbm, 'dBm')} · 처리량 {metric(link.throughputMbps, 'Mbps')}</p>
        <p>보고 연결 비율 {metric(link.reportedAvailabilityPct, '%')} · 표본 {link.sampleCount}개</p>
        {!link.sourceObservedAt && <small>장비 측정 시각 미제공</small>}
      </div>)}</dl>
      <p>기존 장비 보고값입니다. 개별 통신 시험 합격이나 경광봉 출력으로 자동 변환하지 않습니다.</p>
      {data.gateway.state === 'ERROR' && <p>게이트웨이 경로·원본 로그 형식을 확인하세요.</p>}
      {data.gateway.state === 'BLOCKED' && <p>모사·재생 자료는 실장비 상태로 표시하지 않습니다.</p>}
    </details>}
    <details className="operational-disclosure"><summary>시험 연결·출력 설정</summary>
    {local ? <div className="communication-session"><label htmlFor="communication-local-token">로컬 시험 토큰<input id="communication-local-token" type="password" value={token} autoComplete="off" placeholder={session ? '연결 토큰 적용 중' : '복사한 토큰을 붙여넣으세요'} disabled={Boolean(session)} onChange={(e) => setToken(e.target.value)} /></label><div className="communication-session-buttons"><button type="button" className="communication-connect" disabled={token.length < 24 || Boolean(session)} onClick={() => { setData(null); setSession(token); setToken(''); }}>{session ? '연결 요청됨' : '시험 서버 연결'}</button><button type="button" disabled={!session} onClick={() => { setSession(''); setData(null); setError(''); }}>화면 연결 해제</button></div><small>화면 연결을 해제해도 진행 중인 시험은 계속됩니다.</small></div> : <p>장치 시험 제어는 노트북 로컬 상황판에서 실행합니다.</p>}
    <p className="communication-output-status">실제 LED 패널 <strong>{outputLabel(data?.outputs.led)}</strong></p>
    <details className="communication-rules"><summary>출력 방식·판정 기준</summary>
    <p>성공은 초록, 실패는 빨강, 미시험·시험 중·오류·만료는 소등 요청입니다.</p>
    <p>실제 LED 패널: 한 줄 · 우측 이동 · {outputLabel(data?.outputs.led)}</p>
    <p>어댑터 Up·게이트웨이 접속만으로 통신 성공을 판정하지 않습니다. 장비별 드라이버와 상대 장비 응답 확인이 필요합니다. 화면 연결 해제는 실행 중인 시험을 중지하지 않습니다.</p>
    </details>
    </details>
  </section>;
}
