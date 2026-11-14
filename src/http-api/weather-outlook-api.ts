import { dashboardApi, HttpApiError } from "./client";

export type ForecastPeriod = { validAt: string; temperatureC: number | null; humidityPct: number | null; windSpeedMps: number | null; windDirectionDeg: number | null; precipitationType: number | null; precipitationText: string | null };
type Meta = { source: string; stale: boolean; servedAt: string };
export type ForecastResponse = { data: { issuedAt: string; grid: { nx: number; ny: number }; periods: ForecastPeriod[] }; meta: Meta };
export type WarningResponse = { data: { scope: "NATIONWIDE"; issuedAt: string; effectiveAt: string; checkedAt: string; text: string; preliminaryText: string | null }; meta: Meta };
const validTime = (value: unknown): value is string => typeof value === "string" && /(?:Z|[+-]\d{2}:\d{2})$/.test(value) && Number.isFinite(Date.parse(value));
const metric = (value: unknown, min: number, max: number) => value === null || typeof value === "number" && Number.isFinite(value) && value >= min && value <= max;

export function validateForecast(raw: unknown): ForecastResponse {
  const value = raw as ForecastResponse;
  const data = value?.data;
  if (value?.meta?.source !== "KMA_FORECAST" || typeof value.meta.stale !== "boolean" || !validTime(data?.issuedAt) || !Array.isArray(data?.periods) || !data.periods.length || data.periods.length > 6 || !Number.isInteger(data.grid?.nx) || !Number.isInteger(data.grid?.ny) || data.grid.nx < 1 || data.grid.nx > 149 || data.grid.ny < 1 || data.grid.ny > 253) throw new Error("기상청 예보 응답 형식을 확인하세요.");
  for (const row of data.periods) {
    if (!row || !validTime(row.validAt) || !metric(row.temperatureC, -90, 60) || !metric(row.humidityPct, 0, 100) || !metric(row.windSpeedMps, 0, 150) || !metric(row.windDirectionDeg, 0, 360) || !(row.precipitationType === null || [0, 1, 2, 3, 5, 6, 7].includes(row.precipitationType)) || !(row.precipitationText === null || typeof row.precipitationText === "string" && row.precipitationText.length <= 60)) throw new Error("유효하지 않은 기상 예보값입니다.");
  }
  if (data.periods.some((row, index) => Date.parse(row.validAt) <= Date.parse(data.issuedAt) || index > 0 && Date.parse(row.validAt) <= Date.parse(data.periods[index - 1].validAt))) throw new Error("예보 시각 순서를 확인하세요.");
  return value;
}

export function validateWarnings(raw: unknown): WarningResponse {
  const value = raw as WarningResponse;
  const data = value?.data;
  if (value?.meta?.source !== "KMA_WARNING" || typeof value.meta.stale !== "boolean" || data?.scope !== "NATIONWIDE" || !validTime(data.issuedAt) || !validTime(data.effectiveAt) || !validTime(data.checkedAt) || typeof data.text !== "string" || !data.text.trim() || data.text.length > 12000 || !(data.preliminaryText === null || typeof data.preliminaryText === "string" && data.preliminaryText.length <= 12000)) throw new Error("기상특보 현황 응답을 확인하세요.");
  return value;
}

async function read(path: string, signal?: AbortSignal): Promise<unknown> {
  try {
    return await dashboardApi(path, { signal }, import.meta.env.VITE_WEATHER_API_BASE_URL?.trim() || undefined);
  } catch (error) {
    if (signal?.aborted) throw error;
    if (error instanceof HttpApiError) {
      const code = (error.payload as { error?: { code?: string } } | null)?.error?.code;
      if (code === "KMA_WARNING_ACCESS_DENIED") throw new Error("기상특보 조회서비스 접근 거부 · 활용신청 승인 상태와 인증키 권한 확인 필요");
      if (code === "KMA_FORECAST_ACCESS_DENIED") throw new Error("초단기예보 접근 거부 · 상세기능 이용 권한 확인 필요");
      if (code === "NOT_CONFIGURED") throw new Error("기상청 인증키 서버 설정 필요");
      if (code === "PROVIDER_REJECTED") throw new Error("해당 기상청 서비스 활용신청·인증키 권한 확인 필요");
      if (code === "NO_DATA") throw new Error("자료 미수신 · 특보 없음으로 판단하지 않습니다.");
      if (error.status === 404) throw new Error("서버 기능 반영 대기 (404)");
    }
    throw new Error("기상청 자료 수신 실패 · 연결 또는 서버 상태를 확인하세요.");
  }
}
export async function loadForecast(latitude: number, longitude: number, signal?: AbortSignal) {
  return validateForecast(await read(`/api/v1/external/weather/forecast?latitude=${encodeURIComponent(latitude)}&longitude=${encodeURIComponent(longitude)}`, signal));
}
export async function loadWarnings(signal?: AbortSignal) { return validateWarnings(await read("/api/v1/external/weather/warnings", signal)); }
export function forecastIsStale(value: ForecastResponse, now: number) {
  const age = now - Date.parse(value.data.issuedAt);
  return value.meta.stale || age > 3 * 3600_000 || age < -300_000;
}
export function warningsAreStale(value: WarningResponse, now: number) {
  const age = now - Date.parse(value.data.checkedAt);
  return value.meta.stale || age > 15 * 60_000 || age < -300_000;
}
