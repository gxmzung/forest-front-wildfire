import { useEffect, useState, type CSSProperties } from "react";
import { forecastIsStale, loadForecast, loadWarnings, warningsAreStale, type ForecastResponse, type WarningResponse } from "../../http-api/weather-outlook-api";
import { weatherValue, type WeatherResponse } from "../../http-api/weather-api";
import { forecastRain, kstTime, precipitationLabel, weatherTicker } from "./weatherTicker";

export default function WeatherOutlookPanel({ latitude, longitude, observation, observationError, refresh, view = "weather" }: { latitude: number; longitude: number; observation: WeatherResponse | null; observationError: boolean; refresh: number; view?: "weather" | "led" }) {
  const [forecast, setForecast] = useState<ForecastResponse | null>(null);
  const [warnings, setWarnings] = useState<WarningResponse | null>(null);
  const [forecastError, setForecastError] = useState("");
  const [warningError, setWarningError] = useState("");
  const [now, setNow] = useState(Date.now());
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    let active = true;
    let controller: AbortController | null = null;
    function read() {
      controller?.abort(); controller = new AbortController(); const signal = controller.signal;
      void loadForecast(latitude, longitude, signal).then((value) => { if (active && !signal.aborted) { setForecast(value); setForecastError(""); } }, (error: unknown) => { if (active && !signal.aborted) setForecastError(error instanceof Error ? error.message : "예보 수신 실패"); });
      if (view === "weather") void loadWarnings(signal).then((value) => { if (active && !signal.aborted) { setWarnings(value); setWarningError(""); } }, (error: unknown) => { if (active && !signal.aborted) setWarningError(error instanceof Error ? error.message : "특보 수신 실패"); });
    }
    read(); const timer = window.setInterval(read, 300_000);
    return () => { active = false; controller?.abort(); window.clearInterval(timer); };
  }, [latitude, longitude, refresh, view]);
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 30_000); return () => window.clearInterval(timer); }, []);
  const rows = forecast?.data.periods.filter((row) => Date.parse(row.validAt) > now) ?? [];
  const line = weatherTicker(observation, forecast, { latitude, longitude }, now, observationError, Boolean(forecastError));
  const style = { "--ticker-duration": `${Math.max(30, line.length / 5)}s`, animationPlayState: paused ? "paused" : "running" } as CSSProperties;
  if (view === "led") return <section className="weather-environment-panel kma-outlook" aria-label="전광판 제어">
    <header><strong>전광판</strong><span>패널 미연결</span></header>
    <p>현장 기상에서 선택한 조회 위치의 실제 수신값을 사용합니다.</p>
    <p>조회 위치 {latitude.toFixed(5)}, {longitude.toFixed(5)}</p>
    {observationError && <p className="kma-weather-notice">관측 갱신 실패 · 마지막 관측값 표시</p>}
    {forecastError && <p className="kma-weather-notice">예보: {forecastError}</p>}
    <details open>
      <summary>전광판 한 줄 미리보기 · 우측 이동</summary>
      <p>화면 미리보기 · 실제 패널 미연결</p>
      <div className="kma-led-preview" aria-label="전광판 한 줄 미리보기"><span className="kma-led-line" style={style}>{line}</span></div>
      <button type="button" className="kma-weather-retry" onClick={() => setPaused((value) => !value)}>{paused ? "이동 재개" : "이동 일시정지"}</button>
      <details><summary>전체 문구 확인</summary><p>{line}</p></details>
      <p>현장 특보구역 매칭 전까지 전국 특보는 전광판 문구에 자동 포함하지 않습니다.</p>
    </details>
  </section>;
  return <div className="kma-outlook">
    <details open>
      <summary>시간대별 예보 · 관측값과 구분</summary>
      {forecastError && <p role="status" className="kma-weather-notice">{forecastError}{forecast && " · 마지막 예보 표시"}</p>}
      {!forecast && !forecastError && <p>기상청 예보 조회 중…</p>}
      {forecast && <>
        <p>기상청 초단기예보 · 발표 {kstTime(forecast.data.issuedAt)} KST</p>
        {(forecastError || forecastIsStale(forecast, now)) && <p className="kma-weather-notice">예보 갱신 지연 · 마지막 수신 자료</p>}
        {rows.length === 0 ? <p>표시 가능한 향후 예보 없음</p> : <div className="kma-forecast-scroll"><table>
          <caption>조회 지점 인근 5km 격자 예보</caption>
          <thead><tr><th>예보 시각(KST)</th><th>기온</th><th>습도</th><th>풍속</th><th>1시간 강수</th></tr></thead>
          <tbody>{rows.map((row) => <tr key={row.validAt}><td>{kstTime(row.validAt)}</td><td>{weatherValue(row.temperatureC, "℃")}</td><td>{weatherValue(row.humidityPct, "%")}</td><td>{weatherValue(row.windSpeedMps, "m/s")}</td><td>{forecastRain(row.precipitationText)}<br />{precipitationLabel(row.precipitationType)}</td></tr>)}</tbody>
        </table></div>}
      </>}
    </details>
    <details>
      <summary>기상특보 · 전국 현황 {warningError ? "(연결 확인)" : warnings ? "(수신)" : "(조회 중)"}</summary>
      <p>전국 원문입니다. 현재 조회 위치의 특보 자동 판정은 하지 않습니다.</p>
      {warningError && <p role="status" className="kma-weather-notice">{warningError} 특보 없음으로 판단하지 않습니다.</p>}
      {warnings && <>
        {(warningError || warningsAreStale(warnings, now)) && <p className="kma-weather-notice">특보 갱신 지연 · 마지막 수신 자료</p>}
        <p>기상청 발표 {kstTime(warnings.data.issuedAt)} KST · 현황 기준 {kstTime(warnings.data.effectiveAt)} KST</p>
        <p>조회 확인 {kstTime(warnings.data.checkedAt)} KST</p>
        <pre>{warnings.data.text}</pre>
        {warnings.data.preliminaryText && <><strong>예비특보</strong><pre>{warnings.data.preliminaryText}</pre></>}
      </>}
      <a href="https://www.weather.go.kr/w/weather/warning/status.do" target="_blank" rel="noreferrer">기상청 공식 특보 확인</a>
    </details>

  </div>;
}
