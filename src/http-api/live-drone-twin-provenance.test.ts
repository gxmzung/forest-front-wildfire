import { describe, expect, it } from "vitest";
import { isDemonstrationTelemetry, mergeDroneTwins } from "./live-drone-twin";

const eventId = "event-1";
const now = Date.parse("2026-10-11T07:00:05Z");
const timestamp = "2026-10-11T07:00:00Z";
const asset = {
  assetId: "asset-1",
  assetCode: "MD1000-01",
  assetType: "UAV",
  eventId,
};

function verifiedTelemetry(overrides: Record<string, unknown> = {}) {
  return {
    assetId: "MD1000-01",
    sourceAssetId: "MD1000-01",
    assetType: "UAV",
    eventId,
    observedAt: timestamp,
    receivedAt: timestamp,
    latitude: 37.55,
    longitude: 128.4,
    altitude: 123,
    positioningMethod: "RTK_FIXED",
    attributes: {
      telemetryPositionSource: "GLOBAL_POSITION_INT(33)",
      gpsFixType: 6,
      pathEvidence: { coreReceivedAt: timestamp },
    },
    ...overrides,
  };
}

describe("operating drone provenance", () => {
  it("treats synthetic asset specifications and preview-only rows as demonstration data", () => {
    expect(isDemonstrationTelemetry({ specifications: { synthetic: true } })).toBe(true);
    expect(isDemonstrationTelemetry({ previewOnly: true })).toBe(true);
  });

  it("keeps verified physical GCS telemetry", () => {
    const result = mergeDroneTwins([asset], [verifiedTelemetry()], eventId, now);
    expect(result.matched).toBe(1);
    expect(result.positionUnknown).toBe(0);
    expect(result.assets[0]).toMatchObject({
      sourceSystem: "GCS_UPLINK",
      geometry: { coordinates: [128.4, 37.55, 123] },
    });
  });

  it.each([
    ["synthetic flag", { synthetic: true }],
    ["DEMO provenance", { evidenceScope: "LOCAL_SQLITE_DEMO" }],
    ["SIM identifier", { assetId: "SIM-UAV-01", sourceAssetId: "SIM-UAV-01" }],
    ["zero position", { latitude: 0, longitude: 0 }],
    ["missing fix", { positioningMethod: "FIX_NOT_AVAILABLE" }],
    ["non-UAV API row", { assetType: "RTK_TERMINAL" }],
  ])("does not map %s into the operating map", (_label, overrides) => {
    const result = mergeDroneTwins([asset], [verifiedTelemetry(overrides)], eventId, now);
    expect(result.matched).toBe(0);
    expect(result.positionUnknown).toBe(1);
    expect(result.assets[0]).not.toHaveProperty("geometry");
  });

  it("does not invent a position when telemetry is absent", () => {
    const result = mergeDroneTwins([asset], [], eventId, now);
    expect(result.positionUnknown).toBe(1);
    expect(result.assets[0]).not.toHaveProperty("geometry");
  });
});
