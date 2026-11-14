import { dashboardApi, HttpApiError } from "./client";
export type AirQualityResponse = { data: { station: { name: string; address: string; latitude: number; longitude: number }; distanceKm: number; observedAt: string; pm10: number | null; pm25: number | null; pm10Flag: string | null; pm25Flag: string | null }; meta: { source: "AIRKOREA"; stale: boolean; servedAt: string } };
export type RiskRow = { analyzedAt: string; province: string; district: string; sigunguCode: string; regionCode: string; mean: number | null; max: number | null; min: number | null; d1: number | null; d2: number | null; d3: number | null; d4: number | null };
export type RiskResponse = { data: RiskRow[]; meta: { source: "KFS_WILDFIRE"; stale: boolean; servedAt: string; totalCount: number | null } };
const nonnegative = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value) && value >= 0;
export function validateAirQuality(raw: unknown): AirQualityResponse {
  const value = raw as AirQualityResponse;
  const data = value?.data;
  if (value?.meta?.source !== "AIRKOREA" || typeof value.meta.stale !== "boolean" || !data || typeof data.station?.name !== "string" || !data.station.name.trim() || !Number.isFinite(data.station.latitude) || !Number.isFinite(data.station.longitude) || !nonnegative(data.distanceKm) || !Number.isFinite(Date.parse(data.observedAt)) || ![data.pm10, data.pm25].every((x) => x === null || nonnegative(x))) throw new Error("에어코리아 관측값·측정소·시각을 확인하세요.");
  return value;
}
export function validateRisk(raw: unknown): RiskResponse {
  const value = raw as RiskResponse;
  if (value?.meta?.source !== "KFS_WILDFIRE" || typeof value.meta.stale !== "boolean" || !Array.isArray(value.data)) throw new Error("산불위험예보 응답 형식을 확인하세요.");
  for (const row of value.data) {
    if (!row || typeof row.province !== "string" || typeof row.district !== "string" || typeof row.analyzedAt !== "string" || ![row.mean, row.max, row.min, row.d1, row.d2, row.d3, row.d4].every((x) => x === null || nonnegative(x))) throw new Error("산불위험예보 지역·수치를 확인하세요.");
  }
  return value;
}
async function request(path: string, signal?: AbortSignal): Promise<unknown> {
  try { return await dashboardApi(path, { signal }, import.meta.env.VITE_WEATHER_API_BASE_URL?.trim() || undefined); }
  catch (error) {
    if (signal?.aborted) throw error;
    if (error instanceof HttpApiError) {
      const message = (error.payload as { error?: { message?: unknown; code?: string } } | null)?.error;
      if (message?.code === "NOT_CONFIGURED") throw new Error("해당 공공데이터 서비스 활용신청 및 서버 인증키 설정 필요");
      if (message?.code === "PROVIDER_REJECTED") throw new Error("해당 공공데이터 서비스 활용신청·인증키 권한 확인 필요");
      if (error.status === 404) throw new Error("공공데이터 조회 서버 업데이트 필요 (404)");
    }
    throw new Error("공공데이터를 받지 못했습니다. 서비스 권한·서버 연결을 확인하세요.");
  }
}
export async function loadAirQuality(latitude: number, longitude: number, signal?: AbortSignal) { return validateAirQuality(await request(`/api/v1/external/environment/air-quality?latitude=${latitude}&longitude=${longitude}`, signal)); }
export async function loadWildfireRisk(page: number, signal?: AbortSignal) { return validateRisk(await request(`/api/v1/external/environment/wildfire-risk?pageNo=${page}`, signal)); }

// 6시간은 화면의 갱신 안내 정책이며 공식 위험등급이나 발효시간 판정이 아니다.
export function riskAnalysisStale(raw: string, now = Date.now()): boolean | null {
  let iso = raw;
  if (/^\d{10}(?:\d{2})?(?:\d{2})?$/.test(raw)) iso = `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}T${raw.slice(8, 10)}:${raw.slice(10, 12) || "00"}:${raw.slice(12, 14) || "00"}+09:00`;
  else if (!/(?:Z|[+-]\d{2}:\d{2})$/.test(raw)) return null;
  const stamp = Date.parse(iso);
  if (!Number.isFinite(stamp)) return null;
  return now - stamp > 6 * 3600_000 || stamp - now > 300_000;
}
