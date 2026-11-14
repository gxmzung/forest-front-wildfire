import { afterEach, describe, expect, it, vi } from "vitest";
import { loadWeather, validateWeather, weatherIsStale, weatherValue } from "./weather-api";
const observation = () => ({ data: { observedAt: "2026-11-14T13:00:00+09:00", temperatureC: 12, humidityPct: null, windSpeedMps: 0, windDirectionDeg: 180, grid: { nx: 60, ny: 127 } }, meta: { provider: "기상청 초단기실황", source: "KMA_OBSERVATION", cache: "MISS", stale: false, servedAt: "2026-11-14T05:00:00Z", note: "" } });
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
describe("실제 기상정보", () => {
  it("0과 미관측을 구분하고 관측 기준으로 지연을 판정한다", () => {
    const value = validateWeather(observation());
    expect(weatherValue(0, "m/s")).toBe("0m/s");
    expect(weatherValue(null, "%")).toBe("미관측");
    expect(weatherIsStale(value, Date.parse("2026-11-14T05:00:00Z"))).toBe(false);
    expect(weatherIsStale(value, Date.parse("2026-11-14T08:00:00Z"))).toBe(true);
    value.meta.stale = true;
    expect(weatherIsStale(value, Date.parse("2026-11-14T05:00:00Z"))).toBe(true);
  });
  it("모사 출처·잘못된 값·시각을 거절한다", () => {
    expect(() => validateWeather({ ...observation(), meta: { source: "SIMULATOR" } })).toThrow();
    const bad = observation(); bad.data.windSpeedMps = -99;
    expect(() => validateWeather(bad)).toThrow();
    bad.data.observedAt = "invalid";
    expect(() => validateWeather(bad)).toThrow();
  });
  it("운영 대시보드 API로 읽기 요청만 보낸다", async () => {
    const fetcher = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => Response.json(observation()));
    vi.stubGlobal("fetch", fetcher);
    await loadWeather(37.5, 127);
    expect(String(fetcher.mock.calls[0]?.[0])).toBe("https://api.forest.tobeunicorn.kr/api/v1/external/weather?latitude=37.5&longitude=127");
  });
  it("서버 미반영·인증키 누락 시 모사값 없이 실패한다", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ error: { code: "NOT_CONFIGURED" } }, { status: 503 })));
    await expect(loadWeather(37.5, 127)).rejects.toThrow("인증키");
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({}, { status: 404 })));
    await expect(loadWeather(37.5, 127)).rejects.toThrow("404");
  });
  it("날씨 서버만 로컬로 지정해도 다른 관제 API 주소는 바꾸지 않는다", async () => {
    vi.stubEnv("VITE_WEATHER_API_BASE_URL", "http://127.0.0.1:18891/");
    const fetcher = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => Response.json(observation()));
    vi.stubGlobal("fetch", fetcher);
    await loadWeather(37.5, 127);
    const { dashboardApi } = await import("./client");
    await dashboardApi("/health");
    expect(String(fetcher.mock.calls[0]?.[0])).toMatch(/^http:\/\/127.0.0.1:18891\/api\/v1\/external\/weather/);
    expect(String(fetcher.mock.calls[1]?.[0])).toBe("https://api.forest.tobeunicorn.kr/health");
  });
});
