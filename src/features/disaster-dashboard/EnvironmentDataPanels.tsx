import { useCallback, useEffect, useState } from "react";
import { loadAirQuality, loadWildfireRisk, riskAnalysisStale } from "../../http-api/environment-api";
import { kstTime } from "./weatherTicker";
import "./kma-weather.css";

function usePublicData<T>(load: (signal: AbortSignal) => Promise<T>) {
  const [value, setValue] = useState<T | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [revision, setRevision] = useState(0);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    let active = true; let controller: AbortController | null = null;
    async function read() {
      controller?.abort(); controller = new AbortController(); const signal = controller.signal; setLoading(true);
      try { const data = await load(signal); if (active && !signal.aborted) { setValue(data); setError(""); } }
      catch (reason) { if (active && !signal.aborted) setError(reason instanceof Error ? reason.message : "자료 미수신"); }
      finally { if (active && !signal.aborted) setLoading(false); }
    }
    void read(); const timer = window.setInterval(() => void read(), 300_000);
    return () => { active = false; controller?.abort(); window.clearInterval(timer); };
  }, [load, revision]);
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 30_000); return () => window.clearInterval(timer); }, []);
  return { value, error, loading, now, refresh: () => setRevision((value) => value + 1) };
}
const metric = (value: number | null | undefined, unit = "") => value == null ? "미수신" : `${value.toLocaleString("ko-KR", { maximumFractionDigits: 2 })}${unit}`;

export function AirQualityDataPanel({ latitude, longitude }: { latitude: number; longitude: number }) {
  const load = useCallback((signal: AbortSignal) => loadAirQuality(latitude, longitude, signal), [latitude, longitude]);
  const { value, error, loading, now, refresh } = usePublicData(load);
  const age = value ? now - Date.parse(value.data.observedAt) : null;
  const stale = Boolean(error) || value?.meta.stale || age !== null && (age > 3 * 3600_000 || age < -300_000);
  return <section className="environment-data-panel" aria-label="대기질 데이터">
    <header><strong>대기질</strong><button type="button" onClick={refresh} disabled={loading}>{loading ? "조회 중" : "새로고침"}</button></header>
    <p>에어코리아 · 현장 기상에서 선택한 위치 인근 측정소</p>
    <p>조회 위치 {latitude.toFixed(5)}, {longitude.toFixed(5)}</p>
    {error && <p role="status" className="data-warning">{error}{value && " · 마지막 수신값"}</p>}
    <dl><div><dt>미세먼지 PM10</dt><dd>{metric(value?.data.pm10, "㎍/㎥")}</dd></div><div><dt>초미세먼지 PM2.5</dt><dd>{metric(value?.data.pm25, "㎍/㎥")}</dd></div></dl>
    {value ? <>
      {stale && <p className="data-warning">갱신 지연 · 마지막 관측값</p>}
      <p>측정소: {value.data.station.name} · 직선거리 약 {value.data.distanceKm.toFixed(1)}km</p>
      <p>측정소 주소: {value.data.station.address || "미수신"}</p>
      <p>관측 시각: {kstTime(value.data.observedAt)} KST</p>
      {value.data.pm10Flag && <p className="data-warning">PM10 상태: {value.data.pm10Flag}</p>}
      {value.data.pm25Flag && <p className="data-warning">PM2.5 상태: {value.data.pm25Flag}</p>}
    </> : <p>관측 자료 수신 대기</p>}
    <p>인근 측정소 자료이며 현장 연기·유해가스 직접 측정값이 아닙니다.</p>
  </section>;
}

export function WildfireRiskDataPanel() {
  const [page, setPage] = useState(1);
  return <WildfireRiskPage key={page} page={page} onPage={setPage} />;
}
function WildfireRiskPage({ page, onPage }: { page: number; onPage: (page: number) => void }) {
  const load = useCallback((signal: AbortSignal) => loadWildfireRisk(page, signal), [page]);
  const { value, error, loading, refresh } = usePublicData(load);
  const [query, setQuery] = useState("");
  const [selectedKey, setSelectedKey] = useState("");
  const rows = value?.data.filter((row) => `${row.province} ${row.district}`.includes(query.trim())) ?? [];
  const key = (row: (typeof rows)[number], index: number) => `${row.regionCode}:${row.sigunguCode}:${row.analyzedAt}:${index}`;
  const selectedIndex = rows.findIndex((row, index) => key(row, index) === selectedKey);
  const selected = rows[selectedIndex];
  return <section className="environment-data-panel" aria-label="산불위험 데이터">
    <header><strong>산불위험예보</strong><button type="button" onClick={refresh} disabled={loading}>{loading ? "조회 중" : "새로고침"}</button></header>
    <p>산림청 국립산림과학원 · 시군구별 공식 예보 원자료</p>
    {error && <p role="status" className="data-warning">{error}{value && " · 마지막 수신값"}</p>}
    {value?.meta.stale && <p className="data-warning">갱신 지연 · 마지막 수신 자료</p>}
    <label>지역 검색<input value={query} onChange={(event) => { setQuery(event.target.value); setSelectedKey(""); }} placeholder="예: 성주, 합천, 예산" /></label>
    <label>조회 지역<select value={selected ? key(selected, selectedIndex) : ""} onChange={(event) => setSelectedKey(event.target.value)}><option value="">지역 선택</option>{rows.map((row, index) => <option key={key(row, index)} value={key(row, index)}>{row.province} {row.district} · {row.analyzedAt || "분석시각 미수신"}</option>)}</select></label>
    {selected ? <>
      <p>선택 지역: {selected.province} {selected.district}</p>
      <dl><div><dt>평균 위험지수</dt><dd>{metric(selected.mean)}</dd></div><div><dt>최대 위험지수</dt><dd>{metric(selected.max)}</dd></div><div><dt>최소 위험지수</dt><dd>{metric(selected.min)}</dd></div></dl>
      {riskAnalysisStale(selected.analyzedAt) !== false && <p className="data-warning">{riskAnalysisStale(selected.analyzedAt) === null ? "분석시각 형식 확인 필요 · 최신 여부 미확인" : "분석시각이 오래됐거나 기기 시각과 맞지 않습니다. 최신 자료 여부를 확인하세요."}</p>}
      <p>분석 시각(제공 원문): {selected.analyzedAt || "미수신"}</p>
      <p>조회 확인: {value?.meta.servedAt ? kstTime(value.meta.servedAt) + " KST" : "미수신"}</p>
    </> : <p>{loading ? "산불위험 자료 조회 중" : "해당 지역 자료 미수신"}</p>}
    <p>현장 행정구역을 직접 확인해 선택하세요. 좌표 기반 자동 지역 매칭이나 위험등급 임의 산정은 하지 않습니다.</p>
    <div className="data-actions"><button type="button" disabled={page <= 1 || loading} onClick={() => onPage(page - 1)}>이전</button><span>{page}쪽</span><button type="button" disabled={loading || !value || value.data.length < 300 && !(value.meta.totalCount && value.meta.totalCount > page * 300)} onClick={() => onPage(page + 1)}>다음</button></div>
  </section>;
}
