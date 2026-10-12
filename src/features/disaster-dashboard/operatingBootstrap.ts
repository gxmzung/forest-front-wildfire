import type { EventOverview, ForestEvent } from "../../http-api";
import { HttpApiError } from "../../http-api/client";

export type OperatingBootstrapState =
  | "CHECKING"
  | "READY"
  | "DISASTER_NOT_FOUND"
  | "API_UNAVAILABLE";

export type OperatingBootstrapFailure = {
  state: Extract<OperatingBootstrapState, "DISASTER_NOT_FOUND" | "API_UNAVAILABLE">;
  message: string;
};

export function classifyOperatingBootstrapFailure(error: unknown): OperatingBootstrapFailure {
  const missingDisaster =
    error instanceof HttpApiError &&
    error.status === 404 &&
    typeof error.payload === "object" &&
    error.payload !== null &&
    "error" in error.payload &&
    (error.payload as { error?: { code?: string } }).error?.code === "DISASTER_NOT_FOUND";

  if (missingDisaster) {
    return {
      state: "DISASTER_NOT_FOUND",
      message: "설정된 사건 ID에 대응하는 등록 사건이 없습니다.",
    };
  }

  if (error instanceof DOMException && error.name === "TimeoutError") {
    return {
      state: "API_UNAVAILABLE",
      message: "Core API 응답 시간이 초과되었습니다.",
    };
  }

  if (error instanceof TypeError && /failed to fetch/i.test(error.message)) {
    return {
      state: "API_UNAVAILABLE",
      message: "Core API 응답을 확인할 수 없습니다. 네트워크·CORS·서버 상태를 확인해 주세요.",
    };
  }

  return {
    state: "API_UNAVAILABLE",
    message: error instanceof Error ? error.message : "Core API 응답을 확인할 수 없습니다.",
  };
}

export function createOperatingNoDataEvent(
  eventId: string,
  state: OperatingBootstrapFailure["state"],
): ForestEvent {
  return {
    eventId,
    eventCode: state === "DISASTER_NOT_FOUND" ? "등록 사건 없음" : "확인 불가",
    eventName: state === "DISASTER_NOT_FOUND" ? "등록 사건 없음" : "사건 정보 확인 불가",
    status: "UNAVAILABLE",
    severityCode: "UNKNOWN",
    locationName: "데이터 없음",
  };
}

export function createOperatingNoDataOverview(
  event: ForestEvent,
  failure: OperatingBootstrapFailure,
  now = Date.now(),
): EventOverview {
  const checkedAt = new Date(now).toISOString();
  return {
    event,
    assets: [],
    unregisteredAssets: [],
    personnel: [],
    networks: [],
    topology: { networks: [], nodes: [], links: [] },
    alerts: [],
    reports: [],
    kpis: [],
    kpiApiStatus: {
      state: failure.state === "DISASTER_NOT_FOUND" ? "EMPTY" : "ERROR",
      checkedAt,
      message: failure.message,
    },
    integrations: [],
    domainDetail: null,
    domainLayers: {},
    liveDroneTelemetry: {
      status: "UNAVAILABLE",
      matched: 0,
      unmatched: 0,
      live: 0,
      stale: 0,
      offline: 0,
      positionUnknown: 0,
      lastKnown: 0,
    },
    operatingDataStatus: {
      state: failure.state,
      checkedAt,
      message: failure.message,
    },
  };
}
