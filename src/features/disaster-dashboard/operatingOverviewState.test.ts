import { describe, expect, it } from "vitest";
import { markOperatingOverviewUnavailable } from "./operatingOverviewState";
import type { EventOverview } from "../../http-api";

function overview(observedAt: string): EventOverview {
  return {
    event: { eventId: "event-1" },
    assets: [{
      assetId: "drone-1",
      assetType: "UAV",
      sourceSystem: "GCS_UPLINK",
      observedAt,
      receivedAt: observedAt,
      qualityStatus: "LIVE",
      geometry: { type: "Point", coordinates: [128.4, 37.55, 100] },
      attributes: { digitalTwin: { state: "LIVE" } },
    }],
    unregisteredAssets: [],
    personnel: [],
    networks: [],
    topology: { networks: [], nodes: [], links: [] },
    alerts: [],
    reports: [],
    kpis: [{ metricCode: "SHARING_SUCCESS", measuredValue: 99 }],
    integrations: [],
    domainDetail: null,
    domainLayers: {},
    liveDroneTelemetry: {
      status: "CONNECTED",
      matched: 1,
      unmatched: 0,
      live: 1,
      stale: 0,
      offline: 0,
      positionUnknown: 0,
    },
  };
}

describe("operating overview error state", () => {
  const now = Date.parse("2026-10-12T00:00:00Z");

  it("API 오류 시 직전 LIVE 좌표를 STALE 마지막 확인 위치로 강등한다", () => {
    const result = markOperatingOverviewUnavailable(
      overview(new Date(now - 1_000).toISOString()),
      "API timeout",
      now,
    );

    expect(result.assets[0]).toMatchObject({
      qualityStatus: "STALE",
      positionFetchStatus: "Core API 미연결 · 마지막 확인 위치",
      attributes: { digitalTwin: { state: "STALE" } },
    });
    expect(result.liveDroneTelemetry).toMatchObject({
      status: "UNAVAILABLE",
      matched: 0,
      live: 0,
      stale: 1,
      offline: 0,
      lastKnown: 1,
    });
    expect(result.kpis).toEqual([]);
    expect(result.kpiApiStatus).toMatchObject({ state: "ERROR", message: "API timeout" });
  });

  it("오래된 직전 좌표는 OFFLINE으로 구분한다", () => {
    const result = markOperatingOverviewUnavailable(
      overview(new Date(now - 60_000).toISOString()),
      "API timeout",
      now,
    );

    expect(result.assets[0].qualityStatus).toBe("OFFLINE");
    expect(result.liveDroneTelemetry).toMatchObject({ live: 0, stale: 0, offline: 1 });
  });

  it("Core 오류 시 Sleno RTK 좌표도 현재값이 아닌 마지막 확인 위치로 강등한다", () => {
    const observedAt = new Date(now - 1_000).toISOString();
    const input = overview(observedAt);
    input.assets = [{
      assetId: "SLENO_Lab_SingleCH",
      assetType: "RTK_TERMINAL",
      sourceSystem: "sleno-server",
      observedAt,
      receivedAt: observedAt,
      qualityStatus: "LIVE",
      geometry: { type: "Point", coordinates: [127.1, 37.4] },
    }];

    const result = markOperatingOverviewUnavailable(input, "API timeout", now);

    expect(result.assets[0]).toMatchObject({
      qualityStatus: "STALE",
      positionFetchStatus: "Core API 미연결 · 마지막 확인 위치",
    });
    expect(result.liveDroneTelemetry).toMatchObject({ live: 0, stale: 0, offline: 0, lastKnown: 0 });
  });
});
