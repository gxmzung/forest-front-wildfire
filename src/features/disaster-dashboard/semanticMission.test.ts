import { describe, expect, it } from "vitest";
import {
  classifySemanticMissionState,
  isSemanticMissionPacketValid,
  measureSemanticPacket,
  type SemanticMissionPacket,
} from "./semanticMission";

function packet(
  overrides: Partial<SemanticMissionPacket> = {},
): SemanticMissionPacket {
  return {
    schemaVersion: "SEMANTIC-MISSION/0.1",
    packetId: "SEM-001",
    incidentId: "WF-POC-001",
    assetId: "DRONE-01",
    observedAt: "2026-09-20T04:00:00.000Z",
    source: "MOCK",
    experimental: true,
    position: {
      longitude: 127.38,
      latitude: 36.35,
      altitudeM: 210,
    },
    observations: [
      {
        type: "FIRE",
        detected: true,
        confidence: 0.87,
        attributes: {
          spreadDirection: "NE",
          riskLevel: "HIGH",
        },
      },
    ],
    sourceBytes: 1_200_000_000,
    ...overrides,
  };
}

describe("semanticMission PoC", () => {
  it("accepts an experimental semantic mission packet", () => {
    expect(isSemanticMissionPacketValid(packet())).toBe(true);
  });

  it("rejects confidence outside the normalized range", () => {
    expect(
      isSemanticMissionPacketValid(
        packet({
          observations: [
            {
              type: "FIRE",
              detected: true,
              confidence: 1.2,
            },
          ],
        }),
      ),
    ).toBe(false);
  });

  it("classifies recent and stale packets without pretending they are live video", () => {
    const sample = packet();

    expect(
      classifySemanticMissionState(
        sample,
        new Date("2026-09-20T04:00:05.000Z"),
      ),
    ).toBe("RECEIVING");

    expect(
      classifySemanticMissionState(
        sample,
        new Date("2026-09-20T04:00:11.000Z"),
      ),
    ).toBe("STALE");
  });

  it("reports unavailable when no semantic packet exists", () => {
    expect(
      classifySemanticMissionState(
        null,
        new Date("2026-09-20T04:00:00.000Z"),
      ),
    ).toBe("UNAVAILABLE");
  });

  it("measures actual serialized packet size instead of claiming a fixed compression rate", () => {
    const metrics = measureSemanticPacket(packet());

    expect(metrics.packetBytes).toBeGreaterThan(0);
    expect(metrics.sourceBytes).toBe(1_200_000_000);
    expect(metrics.reductionRatio).not.toBeNull();
    expect(metrics.reductionRatio!).toBeGreaterThan(0);
    expect(metrics.reductionRatio!).toBeLessThan(1);
  });
});