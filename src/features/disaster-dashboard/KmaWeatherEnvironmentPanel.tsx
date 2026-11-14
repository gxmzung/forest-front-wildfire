import { useEffect, useRef, useState, type FormEvent } from "react";
import { loadWeather, weatherIsStale, type WeatherResponse } from "../../http-api/weather-api";
import WeatherEnvironmentPanel from "./WeatherEnvironmentPanel";
import { asKmaObservation } from "./kmaWeatherObservation";
import { requestWeatherLocation } from "./weatherLocation";
import WeatherOutlookPanel from "./WeatherOutlookPanel";
import { precipitationLabel } from "./weatherTicker";
import "./kma-weather.css";

export default function KmaWeatherEnvironmentPanel({ latitude, longitude }: { latitude?: unknown; longitude?: unknown }) {
  const [mode, setMode] = useState<"event" | "browser" | "manual">("event");
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState("");
  const [locationInfo, setLocationInfo] = useState<{ accuracy: number; timestamp: number } | null>(null);
  const locationRequest = useRef(0);
  useEffect(() => () => { locationRequest.current += 1; }, []);
  const [latInput, setLatInput] = useState("");
  const [lonInput, setLonInput] = useState("");
  const [target, setTarget] = useState<{ latitude: number; longitude: number } | null>(null);
  const [reading, setReading] = useState<{ location: string; response: WeatherResponse } | null>(null);
  const value = target && reading?.location === `${target.latitude}:${target.longitude}` ? reading.response : null;
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (mode !== "event") return;
    if (typeof latitude !== "number" || typeof longitude !== "number" || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      setTarget(null); setLatInput(""); setLonInput(""); return;
    }
    setLatInput(String(latitude)); setLonInput(String(longitude));
    setTarget({ latitude, longitude });
  }, [latitude, longitude, mode]);

  useEffect(() => {
    setReading(null); setError("");
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
        if (active && !current.signal.aborted) { setReading({ location: `${target!.latitude}:${target!.longitude}`, response }); setError(""); }
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
    locationRequest.current += 1;
    setLocating(false); setLocationError(""); setLocationInfo(null); setMode("manual");
    setTarget({ latitude: lat, longitude: lon });
  }
  async function useCurrentLocation() {
    const request = ++locationRequest.current;
    setLocating(true); setLocationError("");
    try {
      const position = await requestWeatherLocation(navigator.geolocation, window.isSecureContext);
      if (request !== locationRequest.current) return;
      setMode("browser");
      setLocationInfo({ accuracy: position.coords.accuracy, timestamp: position.timestamp });
      setLatInput(String(position.coords.latitude)); setLonInput(String(position.coords.longitude));
      setTarget({ latitude: position.coords.latitude, longitude: position.coords.longitude });
    } catch (reason) {
      if (request === locationRequest.current) setLocationError(reason instanceof Error ? reason.message : "현재 위치를 확인하지 못했습니다.");
    } finally {
      if (request === locationRequest.current) setLocating(false);
    }
  }
  function useEventLocation() {
    locationRequest.current += 1;
    setLocating(false); setLocationInfo(null); setLocationError(""); setMode("event");
  }
  const stale = Boolean(error) || Boolean(value && weatherIsStale(value, now));
  return <WeatherEnvironmentPanel observation={value ? asKmaObservation(value) : null} staleAfterMs={3 * 3600_000}
    afterContent={target ? <WeatherOutlookPanel key={`${target.latitude}:${target.longitude}`} latitude={target.latitude} longitude={target.longitude} observation={value} observationError={Boolean(error)} refresh={refresh} /> : undefined}
    statusLabel={loading ? "조회 중" : error ? "연결 확인" : !value ? "관측 대기" : stale ? "갱신 지연" : "기상청 실황"}>
    <p>기상청 인근 5km 격자 대표 관측값 · 풍선 센서 실측 아님</p>
    <div className="kma-location-actions">
      <button type="button" onClick={() => void useCurrentLocation()} disabled={locating}>{locating ? "위치 확인 중…" : "내 현재 위치로 조회"}</button>
      <button type="button" onClick={useEventLocation}>사건 위치로 조회</button>
    </div>
    <p>위치 기준: {mode === "event" ? "현장 사건 위치" : mode === "browser" ? "이 기기의 현재 위치" : "직접 입력"}</p>
    {locationInfo && mode === "browser" && <p>기기 보고 정확도: 약 ±{Math.round(locationInfo.accuracy).toLocaleString()}m · 위치 확인 {new Date(locationInfo.timestamp).toLocaleTimeString("ko-KR")} · GPS 수신 여부는 확인되지 않습니다.</p>}
    {locationError && <p role="status" className="kma-weather-notice">{locationError} 기존 조회 위치를 유지합니다.</p>}
    <form className="kma-weather-form" onSubmit={submit}>
      <label>위도<input aria-label="날씨 조회 위도" value={latInput} onChange={(event) => setLatInput(event.target.value)} inputMode="decimal" /></label>
      <label>경도<input aria-label="날씨 조회 경도" value={lonInput} onChange={(event) => setLonInput(event.target.value)} inputMode="decimal" /></label>
      <button type="submit" disabled={loading}>조회</button>
    </form>
    {value && <p>강수 형태: {precipitationLabel(value.data.precipitationType)}</p>}
    {target && <p>조회 위치 {target.latitude.toFixed(5)}, {target.longitude.toFixed(5)}</p>}
    {!target && <p>사건의 지점 좌표 또는 직접 입력한 위치로 조회합니다.</p>}
    {error && <p role="status" className="kma-weather-notice">{error}{value && " · 마지막 관측값 표시"}</p>}
    {value && stale && <p className="kma-weather-notice">갱신 지연 · 마지막 관측값입니다.</p>}
    {target && <button type="button" className="kma-weather-retry" onClick={() => setRefresh((count) => count + 1)} disabled={loading}>다시 확인</button>}
  </WeatherEnvironmentPanel>;
}
