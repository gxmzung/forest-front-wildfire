import { afterEach, expect, it, vi } from "vitest";
import { loadAirQuality, loadWildfireRisk, riskAnalysisStale, validateAirQuality, validateRisk } from "./environment-api";
const air = () => ({ data: { station: { name: "대전측정소", address: "대전", latitude: 36.3, longitude: 127.3 }, distanceKm: 2, observedAt: "2026-11-14T14:00:00+09:00", pm10: 0, pm25: null, pm10Flag: null, pm25Flag: "장비점검" }, meta: { source: "AIRKOREA", stale: false, servedAt: "2026-11-14T05:00:00Z" } });
const risk = () => ({ data: [{ province: "충남", district: "예산", analyzedAt: "2026111414", sigunguCode: "44810", regionCode: "1", mean: null, min: 0, max: 30, d1: null, d2: null, d3: null, d4: null }], meta: { source: "KFS_WILDFIRE", stale: false, servedAt: "2026-11-14T05:00:00Z", totalCount: 1 } });
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
it("실제 0과 미수신을 유지하고 다른 출처·잘못된 수치를 거절한다", () => {
  expect(validateAirQuality(air()).data.pm10).toBe(0);
  expect(validateAirQuality(air()).data.pm25).toBeNull();
  const bad = air(); bad.data.pm10 = -99;
  expect(() => validateAirQuality(bad)).toThrow();
  expect(() => validateAirQuality({ ...air(), meta: { source: "DEMO" } })).toThrow();
  expect(validateRisk(risk()).data[0].mean).toBeNull();
  expect(() => validateRisk({ ...risk(), data: [{ ...risk().data[0], mean: "" }] })).toThrow();
});
it("산림·대기질은 지정된 로컬 공공데이터 서버의 GET 경로를 사용한다", async () => {
  vi.stubEnv("VITE_WEATHER_API_BASE_URL", "http://127.0.0.1:18891");
  const fetcher = vi.fn(async (url: RequestInfo | URL) => Response.json(String(url).includes("air-quality") ? air() : risk()));
  vi.stubGlobal("fetch", fetcher);
  await loadAirQuality(36.37, 127.33); await loadWildfireRisk(2);
  expect(String(fetcher.mock.calls[0][0])).toBe("http://127.0.0.1:18891/api/v1/external/environment/air-quality?latitude=36.37&longitude=127.33");
  expect(String(fetcher.mock.calls[1][0])).toBe("http://127.0.0.1:18891/api/v1/external/environment/wildfire-risk?pageNo=2");
});
it("인증키·권한·서버 미반영 오류에서 값을 생성하지 않는다", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => Response.json({ error: { code: "NOT_CONFIGURED" } }, { status: 503 })));
  await expect(loadAirQuality(36, 127)).rejects.toThrow("서버 인증키");
  vi.stubGlobal("fetch", vi.fn(async () => Response.json({ error: { code: "PROVIDER_REJECTED" } }, { status: 502 })));
  await expect(loadAirQuality(36, 127)).rejects.toThrow("권한");
  vi.stubGlobal("fetch", vi.fn(async () => Response.json({}, { status: 404 })));
  await expect(loadWildfireRisk(1)).rejects.toThrow("404");
});


it("실제 산림청의 YYYY-MM-DD HH 분석시각을 KST로 판정한다", () => {
  const now = Date.parse("2026-11-14T16:14:34+09:00");
  expect(riskAnalysisStale("2026-11-14 15", now)).toBe(false);
  expect(riskAnalysisStale("2026-11-14 08", now)).toBe(true);
  expect(riskAnalysisStale("2026-11-15 15", now)).toBe(true);
  expect(riskAnalysisStale("2026-02-30 15", now)).toBeNull();
});
it("에어코리아의 서비스별 인증 거부를 구분한다", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => Response.json({ error: { code: "AIR_STATION_AUTH_FAILED" } }, { status: 502 })));
  await expect(loadAirQuality(36, 127)).rejects.toThrow("측정소정보 API 인증 거부");
  vi.stubGlobal("fetch", vi.fn(async () => Response.json({ error: { code: "AIR_OBSERVATION_AUTH_FAILED" } }, { status: 502 })));
  await expect(loadAirQuality(36, 127)).rejects.toThrow("대기오염정보 API 인증 거부");
});
