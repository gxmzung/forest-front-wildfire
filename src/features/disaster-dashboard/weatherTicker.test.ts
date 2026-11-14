import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { weatherTicker, precipitationLabel, forecastRain } from "./weatherTicker";
import WeatherOutlookPanel from "./WeatherOutlookPanel";
import type { WeatherResponse } from "../../http-api/weather-api";
import type { ForecastResponse } from "../../http-api/weather-outlook-api";
const now = Date.parse("2026-11-14T14:20:00+09:00");
const location = { latitude: 35.8, longitude: 128.1 };
const observation = { data: { observedAt: "2026-11-14T13:00:00+09:00", temperatureC: 12, humidityPct: 0, windSpeedMps: 0, windDirectionDeg: 270, precipitation1hMm: 0, precipitationType: 0, grid: { nx: 60, ny: 127 } }, meta: { source: "KMA_OBSERVATION", stale: false } } as WeatherResponse;
const forecast = { data: { issuedAt: "2026-11-14T13:30:00+09:00", grid: { nx: 60, ny: 127 }, periods: [{ validAt: "2026-11-14T15:00:00+09:00", temperatureC: 11, humidityPct: 95, windSpeedMps: 1, windDirectionDeg: 270, precipitationText: "1.0mm 미만", precipitationType: 1 }] }, meta: { source: "KMA_FORECAST", stale: false } } as ForecastResponse;
describe("전광판 한 줄 실제 기상 문구", () => {
  it("관측과 예보 시각·출처를 구분하고 실제 0·강수 범주를 보존한다", () => {
    const line = weatherTicker(observation, forecast, location, now);
    expect(line).toContain("기상청 관측"); expect(line).toContain("기상청 예보");
    expect(line).toContain("습도 0%"); expect(line).toContain("풍속 0m/s");
    expect(line).toContain("1시간 강수 0mm"); expect(line).toContain("1.0mm 미만");
    expect(line).toContain("탑재 센서 실측 아님"); expect(line).not.toContain("\n");
  });
  it("미수신·결측을 0이나 안전 판정으로 바꾸지 않는다", () => {
    expect(weatherTicker(null, null, location, now)).toContain("관측 미수신");
    const missing = { ...observation, data: { ...observation.data, precipitation1hMm: null, precipitationType: null } };
    expect(weatherTicker(missing, null, location, now)).toContain("1시간 강수 미관측");
    expect(weatherTicker(missing, null, location, now)).toContain("강수 형태 미수신");
    expect(forecastRain(null)).toBe("강수량 미수신"); expect(forecastRain("0")).toBe("0mm");
    expect(precipitationLabel(0)).toBe("강수 없음"); expect(precipitationLabel(undefined)).toContain("미수신");
  });
  it("수신 실패·관측 만료·캐시 대체값을 마지막 값으로 표시하고 과거 예보를 제외한다", () => {
    expect(weatherTicker(observation, forecast, location, now, true, true)).toContain("갱신 지연·마지막 관측값");
    const line = weatherTicker(observation, forecast, location, now + 4 * 3600_000);
    expect(line).toContain("갱신 지연"); expect(line).not.toContain("기상청 예보");
    expect(weatherTicker({ ...observation, meta: { ...observation.meta, stale: true } }, null, location, now)).toContain("갱신 지연");
  });
  it("기상 패널은 데이터만 표시하고 LED 미리보기를 표시하지 않는다", () => {
    const weather = renderToStaticMarkup(createElement(WeatherOutlookPanel, { ...location, observation, observationError: false, refresh: 0 }));
    expect(weather).toContain("현재 조회 위치의 특보 자동 판정은 하지 않습니다");
    expect(weather).not.toContain("전광판 한 줄 미리보기");
    expect(weather).not.toContain("전체 문구 확인");
    expect(weather).not.toContain("kma-led");
  });
});
