import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import WeatherEnvironmentPanel from "./WeatherEnvironmentPanel";
import { expect, it } from "vitest";
import { asKmaObservation } from "./kmaWeatherObservation";
import { evaluateWeatherSnapshot } from "./weatherObservation";
import type { WeatherResponse } from "../../http-api/weather-api";

it("기존 현장 기상 패널에 격자 관측값을 넣고 미제공 순간풍속을 만들지 않는다", () => {
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


it("실황 1시간 강수량 0을 기존 패널에 관측 주기와 함께 표시한다", () => {
  const response = { data: { observedAt: "2026-11-14T13:00:00+09:00", temperatureC: 11.1, humidityPct: 90, windSpeedMps: 0, windDirectionDeg: 52, precipitation1hMm: 0, precipitationType: 0, grid: { nx: 60, ny: 127 } } } as WeatherResponse;
  expect(asKmaObservation(response).precipitationMm).toBe(0);
  expect(asKmaObservation(response).precipitationPeriodMinutes).toBe(60);
});


it("실황 강수는 기존 카드에 표시하고 미제공 순간풍속은 결측과 구분한다", () => {
  const response = { data: { observedAt: new Date().toISOString(), temperatureC: 11.1, humidityPct: 90, windSpeedMps: 0, windDirectionDeg: 52, precipitation1hMm: 0, precipitationType: 0, grid: { nx: 60, ny: 127 } } } as WeatherResponse;
  const markup = renderToStaticMarkup(createElement(WeatherEnvironmentPanel, { observation: asKmaObservation(response), unsupportedFields: ["windGustMps"], showPressure: false }));
  expect(markup).toContain("1시간 강수량</span><b>0</b>");
  expect(markup).toContain("최대순간풍속</span><b>미제공</b>");
  expect(markup).not.toContain("기압:");
});
