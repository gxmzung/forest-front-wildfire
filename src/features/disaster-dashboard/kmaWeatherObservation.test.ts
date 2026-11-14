import { expect, it } from "vitest";
import { asKmaObservation } from "./kmaWeatherObservation";
import { evaluateWeatherSnapshot } from "./weatherObservation";
import type { WeatherResponse } from "../../http-api/weather-api";

it("기존 현장 기상 패널에 격자 관측값을 넣고 미제공 순간풍속·강수량을 만들지 않는다", () => {
  const response = { data: { observedAt: "2026-11-14T13:00:00+09:00", temperatureC: 11.1, humidityPct: 90, windSpeedMps: 0, windDirectionDeg: 52, grid: { nx: 60, ny: 127 } } } as WeatherResponse;
  const value = asKmaObservation(response);
  expect(value.windSpeedMps).toBe(0);
  expect(value.windGustMps).toBeNull();
  expect(value.precipitationMm).toBeNull();
  expect(value.stationName).toContain("특정 관측소 아님");
  const now = Date.parse("2026-11-14T14:00:00+09:00");
  expect(evaluateWeatherSnapshot(value, now).status).toBe("STALE");
  expect(evaluateWeatherSnapshot(value, now, 3 * 3600_000).status).toBe("LIVE");
});
