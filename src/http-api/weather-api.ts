import { dashboardApi, HttpApiError } from "./client";

export type WeatherResponse = {
  data: {
    observedAt: string;
    temperatureC: number | null;
    humidityPct: number | null;
    windSpeedMps: number | null;
    windDirectionDeg: number | null;
    precipitation1hMm?: number | null;
    precipitationType?: number | null;
    grid: { nx: number; ny: number };
  };
  meta: { provider: string; source: "KMA_OBSERVATION"; cache: "HIT" | "MISS" | "STALE"; stale: boolean; servedAt: string; note: string };
};

export function validateWeather(value: unknown): WeatherResponse {
  const result = value as WeatherResponse | null;
  if (!result?.data || result.meta?.source !== "KMA_OBSERVATION" || !Number.isFinite(Date.parse(result.data.observedAt))) throw new Error("기상청 응답 형식을 확인하세요.");
  const ranges = { temperatureC: [-90, 60], humidityPct: [0, 100], windSpeedMps: [0, 150], windDirectionDeg: [0, 360] } as const;
  for (const key of Object.keys(ranges) as (keyof typeof ranges)[]) {
    const item = result.data[key];
    const [min, max] = ranges[key];
    if (item !== null && (typeof item !== "number" || !Number.isFinite(item) || item < min || item > max)) throw new Error("유효하지 않은 기상 측정값입니다.");
  }
  if (result.data.precipitation1hMm != null && (typeof result.data.precipitation1hMm !== "number" || !Number.isFinite(result.data.precipitation1hMm) || result.data.precipitation1hMm < 0 || result.data.precipitation1hMm > 2000)) throw new Error("강수량 응답을 확인하세요.");
  if (result.data.precipitationType != null && ![0, 1, 2, 3, 5, 6, 7].includes(result.data.precipitationType)) throw new Error("강수 형태 응답을 확인하세요.");
  const { nx, ny } = result.data.grid ?? {};
  if (!Number.isInteger(nx) || !Number.isInteger(ny) || nx < 1 || nx > 149 || ny < 1 || ny > 253 || typeof result.meta.stale !== "boolean") throw new Error("기상 격자·갱신 상태를 확인하세요.");
  return result;
}

export function weatherIsStale(value: WeatherResponse, now = Date.now()) {
  const age = now - Date.parse(value.data.observedAt);
  return value.meta.stale || age > 3 * 3600_000 || age < -300_000;
}

export function weatherValue(value: number | null, unit: string) {
  return value === null ? "미관측" : `${value.toLocaleString("ko-KR", { maximumFractionDigits: 1 })}${unit}`;
}

export async function loadWeather(latitude: number, longitude: number, signal?: AbortSignal): Promise<WeatherResponse> {
  try {
    return validateWeather(await dashboardApi(`/api/v1/external/weather?latitude=${encodeURIComponent(latitude)}&longitude=${encodeURIComponent(longitude)}`, { signal }, import.meta.env.VITE_WEATHER_API_BASE_URL?.trim() || undefined));
  } catch (error) {
    if (signal?.aborted) throw error;
    if (error instanceof HttpApiError) {
      const code = (error.payload as { error?: { code?: string } } | null)?.error?.code;
      if (code === "NOT_CONFIGURED") throw new Error("기상청 인증키 서버 설정 필요");
      if (error.status === 404) throw new Error("기상정보 서버 기능 반영 대기 (404)");
      if (error.status === 401 || error.status === 403) throw new Error("기상정보 API 권한 확인 필요");
    }
    throw new Error("기상정보 수신 실패 · 연결 또는 서버 상태 확인 필요");
  }
}
