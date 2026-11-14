import { weatherIsStale, weatherValue, type WeatherResponse } from "../../http-api/weather-api";
import { forecastIsStale, type ForecastResponse } from "../../http-api/weather-outlook-api";

export function precipitationLabel(code: number | null | undefined) {
  return ({ 0: "강수 없음", 1: "비", 2: "비/눈", 3: "눈", 5: "빗방울", 6: "빗방울/눈날림", 7: "눈날림" } as Record<number, string>)[code ?? -1] ?? "강수 형태 미수신";
}
export const kstTime = (value: string) => new Date(value).toLocaleString("ko-KR", { timeZone: "Asia/Seoul", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false });
export function forecastRain(value: string | null) {
  return value === null ? "강수량 미수신" : /^\d+(?:\.\d+)?$/.test(value) ? `${value}mm` : value;
}

/** Single line payload ready for a later LED adapter; no physical transmission. */
export function weatherTicker(observation: WeatherResponse | null, forecast: ForecastResponse | null, location: { latitude: number; longitude: number }, now: number, observationError = false, forecastError = false): string {
  const parts = [`[조회지점 ${location.latitude.toFixed(4)},${location.longitude.toFixed(4)}]`];
  if (!observation) parts.push("기상 관측 미수신");
  else {
    const { data } = observation;
    parts.push(`[기상청 관측 ${kstTime(data.observedAt)} KST${observationError || weatherIsStale(observation, now) ? " · 갱신 지연·마지막 관측값" : ""}]`, `기온 ${weatherValue(data.temperatureC, "℃")}`, `습도 ${weatherValue(data.humidityPct, "%")}`, `풍속 ${weatherValue(data.windSpeedMps, "m/s")}`, `풍향 ${weatherValue(data.windDirectionDeg, "°")}`, `1시간 강수 ${weatherValue(data.precipitation1hMm ?? null, "mm")}`, precipitationLabel(data.precipitationType));
  }
  const next = forecast?.data.periods.find((row) => Date.parse(row.validAt) > now);
  if (forecast && next) parts.push(`[기상청 예보 ${kstTime(next.validAt)} KST${forecastError || forecastIsStale(forecast, now) ? " · 갱신 지연" : ""}]`, `예상 풍속 ${weatherValue(next.windSpeedMps, "m/s")}`, `예상 1시간 강수 ${forecastRain(next.precipitationText)}`);
  parts.push("인근 5km 격자 정보 · 탑재 센서 실측 아님");
  return parts.join(" | ").replace(/\s+/g, " ").trim();
}
