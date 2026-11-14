import type { WeatherResponse } from "../../http-api/weather-api";
import type { WeatherObservation } from "./weatherObservation";

export function asKmaObservation(response: WeatherResponse): WeatherObservation {
  const { data } = response;
  return {
    stationId: `KMA-GRID-${data.grid.nx}-${data.grid.ny}`,
    stationName: `기상청 격자 ${data.grid.nx} / ${data.grid.ny} (특정 관측소 아님)`,
    observedAt: data.observedAt,
    source: "기상청 초단기실황 · 5km 격자 대표 관측값",
    sourceMode: "LIVE",
    temperatureC: data.temperatureC,
    humidityPct: data.humidityPct,
    windSpeedMps: data.windSpeedMps,
    windDirectionDeg: data.windDirectionDeg,
    windGustMps: null,
    precipitationMm: null,
    precipitationPeriodMinutes: null,
  };
}
