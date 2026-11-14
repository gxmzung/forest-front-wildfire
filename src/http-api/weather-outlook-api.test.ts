import { afterEach, expect, it, vi } from "vitest";
import { forecastIsStale, loadForecast, loadWarnings, validateForecast, validateWarnings, warningsAreStale } from "./weather-outlook-api";
const forecast = () => ({ data: { issuedAt: "2026-11-14T13:30:00+09:00", grid: { nx: 60, ny: 127 }, periods: [{ validAt: "2026-11-14T15:00:00+09:00", temperatureC: 12, humidityPct: 0, windSpeedMps: 0, windDirectionDeg: null, precipitationText: "1.0mm 미만", precipitationType: 1 }] }, meta: { source: "KMA_FORECAST", stale: false, servedAt: "2026-11-14T05:00:00Z" } });
const warnings = () => ({ data: { scope: "NATIONWIDE", issuedAt: "2026-11-14T13:00:00+09:00", effectiveAt: "2026-11-14T13:00:00+09:00", checkedAt: "2026-11-14T05:00:00Z", text: "강풍주의보 : 제주도", preliminaryText: null }, meta: { source: "KMA_WARNING", stale: false, servedAt: "2026-11-14T05:00:00Z" } });
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
it("관측과 다른 예보 출처·시각·범위를 검사한다", () => {
  const valid = validateForecast(forecast());
  expect(valid.data.periods[0].windSpeedMps).toBe(0);
  const wrong = forecast(); wrong.data.periods[0].humidityPct = 200;
  expect(() => validateForecast(wrong)).toThrow();
  expect(() => validateForecast({ ...forecast(), meta: { source: "DEMO" } })).toThrow();
  const unordered = forecast(); unordered.data.periods.push(unordered.data.periods[0]);
  expect(() => validateForecast(unordered)).toThrow();
  expect(forecastIsStale(valid, Date.parse("2026-11-14T14:00:00+09:00"))).toBe(false);
  expect(forecastIsStale(valid, Date.parse("2026-11-14T18:00:00+09:00"))).toBe(true);
});
it("전국 특보만 수용하고 빈 본문을 특보 없음으로 해석하지 않는다", () => {
  const valid = validateWarnings(warnings());
  expect(warningsAreStale(valid, Date.parse("2026-11-14T05:10:00Z"))).toBe(false);
  expect(warningsAreStale(valid, Date.parse("2026-11-14T05:16:00Z"))).toBe(true);
  const empty = warnings(); empty.data.text = "";
  expect(() => validateWarnings(empty)).toThrow();
  expect(() => validateWarnings({ ...warnings(), data: { ...warnings().data, scope: "LOCAL" } })).toThrow();
});
it("예보·특보는 로컬 날씨 서버의 읽기 경로만 이용한다", async () => {
  vi.stubEnv("VITE_WEATHER_API_BASE_URL", "http://127.0.0.1:18891");
  const fetcher = vi.fn(async (url: RequestInfo | URL) => Response.json(String(url).includes("forecast") ? forecast() : warnings()));
  vi.stubGlobal("fetch", fetcher);
  await loadForecast(35.8, 128.1); await loadWarnings();
  expect(String(fetcher.mock.calls[0][0])).toBe("http://127.0.0.1:18891/api/v1/external/weather/forecast?latitude=35.8&longitude=128.1");
  expect(String(fetcher.mock.calls[1][0])).toBe("http://127.0.0.1:18891/api/v1/external/weather/warnings");
});
it("서비스별 권한 누락·서버 미반영 상태를 표시한다", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => Response.json({ error: { code: "PROVIDER_REJECTED" } }, { status: 502 })));
  await expect(loadWarnings()).rejects.toThrow("활용신청");
  vi.stubGlobal("fetch", vi.fn(async () => Response.json({}, { status: 404 })));
  await expect(loadForecast(35.8, 128.1)).rejects.toThrow("404");
});

it("기상청 특보·예보 접근 거부를 서비스별로 안내한다", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => Response.json({ error: { code: "KMA_WARNING_ACCESS_DENIED" } }, { status: 502 })));
  await expect(loadWarnings()).rejects.toThrow("기상특보 조회서비스 접근 거부");
  vi.stubGlobal("fetch", vi.fn(async () => Response.json({ error: { code: "KMA_FORECAST_ACCESS_DENIED" } }, { status: 502 })));
  await expect(loadForecast(36, 127)).rejects.toThrow("초단기예보 접근 거부");
});
