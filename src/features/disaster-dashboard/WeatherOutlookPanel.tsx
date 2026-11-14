import { useEffect, useState } from "react";
import { forecastIsStale, loadForecast, loadWarnings, warningsAreStale, type ForecastResponse, type WarningResponse } from "../../http-api/weather-outlook-api";
import { weatherValue, type WeatherResponse } from "../../http-api/weather-api";
import { forecastRain, kstTime, precipitationLabel } from "./weatherTicker";

export default function WeatherOutlookPanel({ latitude, longitude, observation, observationError, refresh }: { latitude: number; longitude: number; observation: WeatherResponse | null; observationError: boolean; refresh: number }) {
  const [forecast, setForecast] = useState<ForecastResponse | null>(null);
  const [warnings, setWarnings] = useState<WarningResponse | null>(null);
  const [forecastError, setForecastError] = useState("");
  const [warningError, setWarningError] = useState("");
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    let active = true;
    let controller: AbortController | null = null;
    function read() {
      controller?.abort(); controller = new AbortController(); const signal = controller.signal;
      void loadForecast(latitude, longitude, signal).then((value) => { if (active && !signal.aborted) { setForecast(value); setForecastError(""); } }, (error: unknown) => { if (active && !signal.aborted) setForecastError(error instanceof Error ? error.message : "예보 수신 실패"); });
      void loadWarnings(signal).then((value) => { if (active && !signal.aborted) { setWarnings(value); setWarningError(""); } }, (error: unknown) => { if (active && !signal.aborted) setWarningError(error instanceof Error ? error.message : "특보 수신 실패"); });
    }
    read(); const timer = window.setInterval(read, 300_000);
    return () => { active = false; controller?.abort(); window.clearInterval(timer); };
  }, [latitude, longitude, refresh]);
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 30_000); return () => window.clearInterval(timer); }, []);
  const rows = forecast?.data.periods.filter((row) => Date.parse(row.validAt) > now) ?? [];
  return <div className="kma-outlook">
    <details>
      <summary>시간대별 예보 · {forecastError ? '수신 실패' : forecast ? '수신 자료' : '조회 중'}</summary>
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
      <summary>기상특보 · 전국 {warningError ? '확인 불가' : warnings ? '수신 자료' : '조회 중'}</summary>
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
