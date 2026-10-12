import { afterEach, expect, it, vi } from "vitest";
import { forestApi, loadEventOverview } from "./forest-api";

afterEach(() => vi.restoreAllMocks());

it("operating overview loads verified Core telemetry and exposes canonical map geometry", async () => {
  const eventId = "integration-flight";
  const now = new Date().toISOString();
  vi.spyOn(forestApi, "dashboardDisasterAssets").mockResolvedValue({
    data: {
      disaster: { disasterId: eventId },
      assetCount: 1,
      assets: [{
        assignment: { asset_id: "uuid", event_id: eventId, event_resource_id: "assignment", released_at: null },
        asset: { asset_id: "uuid", asset_code: "MD1000-01", asset_type: "UAV", asset_name: "registered" },
      }],
    },
  });
  vi.spyOn(forestApi, "dashboardDroneTelemetry").mockResolvedValue({
    data: [{
      assetId: "MD1000-01",
      assetType: "UAV",
      eventId,
      observedAt: now,
      receivedAt: now,
      latitude: 37.55,
      longitude: 128.4,
      altitude: 123,
      attributes: {
        telemetryPositionSource: "GLOBAL_POSITION_INT(33)",
        gpsFixType: 6,
        pathEvidence: { coreReceivedAt: now },
      },
    }],
  });
  vi.spyOn(forestApi, "resources").mockResolvedValue({
    data: [{
      metricCode: "SHARING_SUCCESS",
      measuredValue: 98.8,
      unit: "%",
      testRunId: "RUN-1",
      measurementSource: "CORE",
      rawLogRefs: ["log-1"],
      verificationStatus: "VERIFIED",
      evidenceVerificationStatus: "VERIFIED",
      receivedAt: now,
    }],
    page: { limit: 100, nextCursor: null },
  });

  const result = await loadEventOverview({ eventId });
  expect(result.assets[0]).toMatchObject({
    assetId: "uuid",
    geometry: { type: "Point", coordinates: [128.4, 37.55, 123] },
    positionFetchStatus: "Core API 조회 성공 · 최근 관측",
  });
  expect(result.liveDroneTelemetry).toEqual({
    status: "CONNECTED",
    matched: 1,
    unmatched: 0,
    live: 1,
    stale: 0,
    offline: 0,
    positionUnknown: 0,
  });
  expect(result.kpis).toHaveLength(1);
  expect(result.kpiApiStatus?.state).toBe("FRESH");
});

it("operating overview excludes assigned SIM and synthetic assets", async () => {
  const eventId = "integration-filter";
  vi.spyOn(forestApi, "dashboardDisasterAssets").mockResolvedValue({
    data: {
      disaster: { disasterId: eventId },
      assetCount: 2,
      assets: [
        {
          assignment: { asset_id: "sim", event_id: eventId, event_resource_id: "a1", released_at: null },
          asset: { asset_id: "sim", asset_code: "SIM-UAV-01", asset_type: "UAV", asset_name: "simulation" },
        },
        {
          assignment: { asset_id: "preview", event_id: eventId, event_resource_id: "a2", released_at: null },
          asset: {
            asset_id: "preview",
            asset_code: "UAV-PREVIEW",
            asset_type: "UAV",
            asset_name: "preview",
            specifications: { synthetic: true },
          },
        },
      ],
    },
  });
  vi.spyOn(forestApi, "dashboardDroneTelemetry").mockResolvedValue({ data: [] });
  vi.spyOn(forestApi, "resources").mockResolvedValue({ data: [], page: { limit: 100, nextCursor: null } });

  const result = await loadEventOverview({ eventId });
  expect(result.assets).toEqual([]);
  expect(result.liveDroneTelemetry).toMatchObject({ matched: 0, live: 0, positionUnknown: 0 });
});
