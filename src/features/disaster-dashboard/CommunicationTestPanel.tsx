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
  async function command(path: string, body: object) {
    setPending(true);
    try {
      const response = await fetch(`${BASE}${path}`, { method: 'POST', headers: { Authorization: `Bearer ${session}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(5000) });
      if (!response.ok) throw Error(String(response.status)); setError('');
    } catch { setError('시험 요청 실패 · 드라이버 설정과 실행 중인 시험을 확인하세요.'); }
    finally { setPending(false); }
  }
  const selected = data?.tests.find((r) => r.id === data.selectedRunId);
  return <section className="environment-data-panel" aria-label="통신 종류별 실장비 시험">
    <header><strong>통신 종류별 시험</strong><span>{data ? '로컬 시험 서버 연결' : '연결 대기'}</span></header>
    <p>선택 시험: {selected ? communicationLabels[selected.transport] : '없음'} · 경광봉: {data ? ({ GREEN: '초록 요청', RED: '빨강 요청', OFF: '소등 요청' }[data.baton.color]) : '연결 대기'}</p>
    {error && <p className="data-warning" role="status">{error}</p>}
    <dl>{communicationTransports.map((transport) => {
      const row = data?.tests.find((t) => t.transport === transport);
      return <div key={transport}><dt>{communicationLabels[transport]}</dt><dd>{row ? communicationStates[row.state] : session ? '결과 미수신' : '미시험'}</dd>
        {row?.evidence && <small>수신 {row.evidence.received}/{row.evidence.sent}{row.evidence.latencyMs != null ? ` · ${row.evidence.latencyMs}ms` : ''}</small>}
        {data?.configured.includes(transport) && <button type="button" disabled={pending || row?.state === 'RUNNING'} onClick={() => void command('/tests/run', { transport })}>시험 실행</button>}
        {row?.id && <button type="button" disabled={pending || data?.selectedRunId === row.id} onClick={() => void command('/tests/select', { runId: row.id })}>{data?.selectedRunId === row.id ? '경광봉 표시 대상' : '표시 대상으로 선택'}</button>}
      </div>;
    })}</dl>
    <p>경광봉 출력: {outputLabel(data?.outputs.relay)}</p>
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
    {local ? <div className="data-actions"><label>로컬 시험 토큰<input type="password" value={token} autoComplete="off" onChange={(e) => setToken(e.target.value)} /></label><button type="button" disabled={token.length < 24 || Boolean(session)} onClick={() => { setData(null); setSession(token); setToken(''); }}>시험 서버 연결</button><button type="button" disabled={!session} onClick={() => { setSession(''); setData(null); setError(''); }}>화면 연결 해제</button></div> : <p>장치 시험 제어는 노트북 로컬 상황판에서 실행합니다.</p>}
    <p>성공은 초록, 실패는 빨강, 미시험·시험 중·오류·만료는 소등 요청입니다.</p>
    <p>실제 LED 패널: 한 줄 · 우측 이동 · {outputLabel(data?.outputs.led)}</p>
    <p>어댑터 Up·게이트웨이 접속만으로 통신 성공을 판정하지 않습니다. 장비별 드라이버와 상대 장비 응답 확인이 필요합니다. 화면 연결 해제는 실행 중인 시험을 중지하지 않습니다.</p>
    </details>
  </section>;
}
