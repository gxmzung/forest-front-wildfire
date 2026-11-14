import { useEffect, useState, type FormEvent } from "react";
import { loadWeather, weatherIsStale, weatherValue, type WeatherResponse } from "../../http-api/weather-api";
import "./weather-panel.css";

export default function WeatherPanel({ latitude, longitude }: { latitude?: unknown; longitude?: unknown }) {
  const [latInput, setLatInput] = useState("");
  const [lonInput, setLonInput] = useState("");
  const [target, setTarget] = useState<{ latitude: number; longitude: number } | null>(null);
  const [value, setValue] = useState<WeatherResponse | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (typeof latitude !== "number" || typeof longitude !== "number" || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      setTarget(null); setLatInput(""); setLonInput(""); return;
    }
    setLatInput(String(latitude)); setLonInput(String(longitude));
    setTarget({ latitude, longitude });
  }, [latitude, longitude]);

  useEffect(() => {
    setValue(null); setError("");
  }, [target]);

  useEffect(() => {
    if (!target) { setLoading(false); return; }
    let active = true;
    let controller: AbortController | null = null;
    async function read() {
      controller?.abort();
      controller = new AbortController();
      const current = controller;
      setLoading(true);
      try {
        const response = await loadWeather(target!.latitude, target!.longitude, current.signal);
        if (active && !current.signal.aborted) { setValue(response); setError(""); }
      } catch (reason) {
        if (active && !current.signal.aborted) setError(reason instanceof Error ? reason.message : "기상정보 수신 실패");
      } finally {
        if (active && !current.signal.aborted) setLoading(false);
      }
    }
    void read();
    const timer = window.setInterval(() => void read(), 300_000);
    return () => { active = false; controller?.abort(); window.clearInterval(timer); };
  }, [target, refresh]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  function submit(event: FormEvent) {
    event.preventDefault();
    const lat = Number(latInput), lon = Number(lonInput);
    if (!latInput.trim() || !lonInput.trim() || !Number.isFinite(lat) || !Number.isFinite(lon) || lat < 31 || lat > 44 || lon < 123 || lon > 133) {
      setError("국내 조회 위치의 위도·경도를 입력하세요."); return;
    }
    setTarget({ latitude: lat, longitude: lon });
  }
  const stale = Boolean(error) || Boolean(value && weatherIsStale(value, now));
  return <details className="weather-panel" open>
    <summary>기상청 실제 날씨 <span>{loading ? "조회 중" : error ? "연결 확인" : !value ? "위치 설정" : stale ? "갱신 지연" : "실황 수신"}</span></summary>
    <div className="weather-panel-body">
      <p>인근 5km 격자 대표 관측값 · 풍선 센서 실측 아님</p>
      <form onSubmit={submit}>
        <label>위도<input aria-label="날씨 조회 위도" value={latInput} onChange={(event) => setLatInput(event.target.value)} inputMode="decimal" placeholder="위도" /></label>
        <label>경도<input aria-label="날씨 조회 경도" value={lonInput} onChange={(event) => setLonInput(event.target.value)} inputMode="decimal" placeholder="경도" /></label>
        <button type="submit" disabled={loading}>조회</button>
      </form>
      {target && <small>조회 위치 {target.latitude.toFixed(5)}, {target.longitude.toFixed(5)}</small>}
      {error && <p role="status" className="weather-error">{error}{value && " · 마지막 관측값 표시"}</p>}
      {!target && <p>사건의 지점 좌표 또는 직접 입력한 위치로 조회합니다.</p>}
      {value && <>
        <dl data-stale={stale}>
          <div><dt>기온</dt><dd>{weatherValue(value.data.temperatureC, "℃")}</dd></div>
          <div><dt>습도</dt><dd>{weatherValue(value.data.humidityPct, "%")}</dd></div>
          <div><dt>풍속</dt><dd>{weatherValue(value.data.windSpeedMps, "m/s")}</dd></div>
          <div><dt>풍향</dt><dd>{weatherValue(value.data.windDirectionDeg, "°")}</dd></div>
        </dl>
        <small>관측 {new Date(value.data.observedAt).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })} KST</small>
        <small>출처: 기상청 초단기실황 · 격자 {value.data.grid.nx}, {value.data.grid.ny}</small>
        {stale && <p className="weather-error">갱신 지연 · 현재 현장 측정값으로 사용하지 마세요.</p>}
      </>}
      {target && <button type="button" onClick={() => setRefresh((count) => count + 1)} disabled={loading}>다시 확인</button>}
    </div>
  </details>;
}
