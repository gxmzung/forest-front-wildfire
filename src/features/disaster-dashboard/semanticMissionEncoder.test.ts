import { describe, expect, it } from "vitest";
import { isSemanticMissionPacketValid, measureSemanticPacket } from "./semanticMission";
import { encodeSemanticMissionMock } from "./semanticMissionEncoder";

describe("semanticMissionEncoder PoC", () => {
  it("encodes mock wildfire observations into an explicitly experimental packet", () => {
    const packet = encodeSemanticMissionMock({
      incidentId: "WF-POC-001",
      assetId: "DRONE-01",
      observedAt: "2026-09-20T05:00:00.000Z",
      sourceBytes: 4_000_000,
      position: {
        longitude: 127.38,
        latitude: 36.35,
        altitudeM: 215,
      },
      fire: {
        detected: true,
        confidence: 0.91,
        spreadDirection: "NE",
        riskLevel: "HIGH",
      },
      smoke: {
        detected: true,
        confidence: 0.84,
        density: "HIGH",
      },
    });

    expect(packet.source).toBe("MOCK");
    expect(packet.experimental).toBe(true);
    expect(packet.observations).toHaveLength(2);
    expect(packet.observations[0]?.type).toBe("FIRE");
    expect(packet.observations[1]?.type).toBe("SMOKE");
    expect(isSemanticMissionPacketValid(packet)).toBe(true);
  });

  it("omits undefined semantic attributes instead of inventing values", () => {
    const packet = encodeSemanticMissionMock({
      incidentId: "WF-POC-002",
      assetId: "DRONE-02",
      observedAt: "2026-09-20T05:01:00.000Z",
      fire: {
        detected: true,
        confidence: 0.72,
      },
    });

    expect(packet.observations[0]?.attributes).toBeUndefined();
  });

  it("measures the PoC packet against the supplied source size", () => {
    const packet = encodeSemanticMissionMock({
      incidentId: "WF-POC-003",
      assetId: "DRONE-03",
      observedAt: "2026-09-20T05:02:00.000Z",
      sourceBytes: 8_000_000,
      fire: {
        detected: true,
        confidence: 0.88,
        spreadDirection: "E",
      },
    });

    const metrics = measureSemanticPacket(packet);

    expect(metrics.packetBytes).toBeGreaterThan(0);
    expect(metrics.sourceBytes).toBe(8_000_000);
    expect(metrics.reductionRatio).not.toBeNull();
    expect(metrics.reductionRatio!).toBeLessThan(1);
  });
});