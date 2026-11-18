////
//// 20261011 이영준
//// 왼쪽 현장 기상 기본 화면 · 실측 API 연동 전 숫자 미표시
////

import { useEffect, useState } from "react";
import { dashboardApi } from "../../http-api/client";
import type { ForestEvent } from "../../http-api/forest-api";
import { evaluateWeatherSnapshot, normalizeWeatherObservation, type WeatherObservation } from "./weatherObservation";

interface WeatherResponse { observation: WeatherObservation; nextRefreshAt: string; intervalSeconds: number; stale: boolean }

const fields: Array<{ key: keyof WeatherObservation; label: string; unit: string }> = [
  { key: "temperatureC", label: "기온", unit: "°C" },
  { key: "humidityPct", label: "상대습도", unit: "%" },
  { key: "windSpeedMps", label: "평균 풍속", unit: "m/s" },
  { key: "windDirectionDeg", label: "풍향", unit: "°" },
  { key: "windGustMps", label: "최대순간풍속", unit: "m/s" },
  { key: "precipitationMm", label: "강수량", unit: "mm" },
];

export default function WeatherEnvironmentPanel({ event }: { event: ForestEvent }) {
  const [weather, setWeather] = useState<WeatherResponse | null>(null);
  const [error, setError] = useState("");
  const geometryKey = JSON.stringify(event.geometry);
  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    setWeather(null);
    setError("");
    async function update() {
      let delay = 60_000;
      try {
        const result = await dashboardApi<{ data: WeatherResponse }>(`/api/v1/external/weather/current?eventId=${encodeURIComponent(event.eventId)}`, { signal: controller.signal });
        if (controller.signal.aborted) return;
        const observation = normalizeWeatherObservation(result.data.observation, "LIVE");
        if (!observation) throw new Error("날씨 응답을 확인할 수 없습니다.");
        setWeather({ ...result.data, observation });
        setError(result.data.stale ? "날씨 갱신 지연" : "");
        if (!result.data.stale) delay = Math.max(60_000, Date.parse(result.data.nextRefreshAt) - Date.now());
      } catch (cause) {
        if (controller.signal.aborted) return;
        setError(cause instanceof Error ? cause.message : "날씨 조회 실패");
      }
      timer = setTimeout(update, delay);
    }
    void update();
    return () => { controller.abort(); clearTimeout(timer); };
  }, [event.eventId, geometryKey]);
  const snapshot = evaluateWeatherSnapshot(weather?.observation ?? null);
  const current = snapshot.observation;
  const label = error ? "갱신 지연" : snapshot.status === "LIVE" ? "기상모델" : snapshot.status === "STALE" ? "갱신 지연" : "날씨 조회 중";
  return (
    <section className="weather-environment-panel" aria-label="현장 기상 종합정보">
      <header><strong>현장 기상 종합정보</strong><span>{label}</span></header>
      <div className="weather-environment-grid">
        {fields.map(field => {
          const value = current?.[field.key];
          return (
            <article key={field.key}>
              <span>{field.label}</span>
              <b>{typeof value === "number" && Number.isFinite(value) ? value.toLocaleString("ko-KR") : "—"}</b>
              <small>{field.unit}</small>
            </article>
          );
        })}
      </div>
      {error && <p role="status">{error}</p>}
      <p>기압: {current?.surfacePressureHpa ?? "—"} hPa</p>
      <p>산불 구역: {current?.stationName ?? event.locationName ?? event.eventName}</p>
      <p>기준 시각: {current?.observedAt ? new Date(current.observedAt).toLocaleString("ko-KR") : "—"}</p>
      <p>현재값 시간 간격: {weather ? `${weather.intervalSeconds / 60}분` : "—"}</p>
      <p>다음 확인: {weather ? new Date(weather.nextRefreshAt).toLocaleString("ko-KR") : "—"}</p>
      <p>데이터 출처: <a href="https://open-meteo.com/" target="_blank" rel="noreferrer">Open-Meteo · 기상모델</a></p>
    </section>
  );
}
