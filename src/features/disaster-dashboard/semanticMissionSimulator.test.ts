import { describe, expect, it } from "vitest";
import { encodeSemanticMissionMock } from "./semanticMissionEncoder";
import { createSemanticMissionSnapshot } from "./semanticMissionSimulator";

function samplePacket() {
  return encodeSemanticMissionMock({
    incidentId: "WF-POC-SIM",
    assetId: "DRONE-01",
    observedAt: "2026-09-20T05:10:00.000Z",
    sourceBytes: 6_000_000,
    position: {
      longitude: 127.38,
      latitude: 36.35,
      altitudeM: 220,
    },
    fire: {
      detected: true,
      confidence: 0.9,
      spreadDirection: "NE",
      riskLevel: "HIGH",
    },
  });
}

describe("semanticMissionSimulator PoC", () => {
  it("reports a recently received experimental packet as RECEIVING", () => {
    const snapshot = createSemanticMissionSnapshot(
      samplePacket(),
      new Date("2026-09-20T05:10:04.000Z"),
    );

    expect(snapshot.state).toBe("RECEIVING");
    expect(snapshot.experimental).toBe(true);
    expect(snapshot.packetAgeMs).toBe(4_000);
    expect(snapshot.packetBytes).toBeGreaterThan(0);
  });

  it("moves the same packet to STALE after the freshness window", () => {
    const snapshot = createSemanticMissionSnapshot(
      samplePacket(),
      new Date("2026-09-20T05:10:11.000Z"),
    );

    expect(snapshot.state).toBe("STALE");
    expect(snapshot.packetAgeMs).toBe(11_000);
  });

  it("reports UNAVAILABLE without inventing semantic observations", () => {
    const snapshot = createSemanticMissionSnapshot(
      null,
      new Date("2026-09-20T05:10:20.000Z"),
    );

    expect(snapshot.state).toBe("UNAVAILABLE");
    expect(snapshot.packet).toBeNull();
    expect(snapshot.packetBytes).toBeNull();
    expect(snapshot.reductionRatio).toBeNull();
  });

  it("carries measured packet metrics into the simulator snapshot", () => {
    const snapshot = createSemanticMissionSnapshot(
      samplePacket(),
      new Date("2026-09-20T05:10:01.000Z"),
    );

    expect(snapshot.sourceBytes).toBe(6_000_000);
    expect(snapshot.packetBytes).toBeGreaterThan(0);
    expect(snapshot.reductionRatio).not.toBeNull();
    expect(snapshot.reductionRatio!).toBeLessThan(1);
  });
});