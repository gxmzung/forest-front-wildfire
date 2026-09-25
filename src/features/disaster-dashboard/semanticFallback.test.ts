import { describe, expect, it } from "vitest";
import type { SemanticMissionPacket } from "./semanticMission";
import { decideSemanticFallback } from "./semanticFallback";

const now = new Date("2026-09-21T02:30:00.000Z");

function packet(
  overrides: Partial<SemanticMissionPacket> = {},
): SemanticMissionPacket {
  return {
    schemaVersion: "SEMANTIC-MISSION/0.1",
    packetId: "mock-packet-1",
    incidentId: "incident-1",
    assetId: "crew-12",
    observedAt: "2026-09-21T02:29:55.000Z",
    source: "MOCK",
    experimental: true,
    observations: [
      {
        type: "FIRE",
        detected: true,
        confidence: 0.68,
      },
    ],
    ...overrides,
  };
}

describe("semantic fallback policy", () => {
  it("keeps LIVE while the link is connected", () => {
    const result = decideSemanticFallback("CONNECTED", packet(), now);

    expect(result.mode).toBe("LIVE");
    expect(result.predicted).toBe(false);
  });

  it("keeps degraded live mode while the link is delayed", () => {
    const result = decideSemanticFallback("DELAYED", packet(), now);

    expect(result.mode).toBe("DEGRADED");
    expect(result.predicted).toBe(false);
  });

  it("activates Semantic PoC only for a fresh valid packet after disconnect", () => {
    const result = decideSemanticFallback("DISCONNECTED", packet(), now);

    expect(result.mode).toBe("SEMANTIC_POC");
    expect(result.semanticState).toBe("RECEIVING");
    expect(result.experimental).toBe(true);
    expect(result.mock).toBe(true);
    expect(result.predicted).toBe(true);
  });

  it("does not use a stale packet as predicted information", () => {
    const result = decideSemanticFallback(
      "DISCONNECTED",
      packet({ observedAt: "2026-09-21T02:29:30.000Z" }),
      now,
    );

    expect(result.mode).toBe("UNAVAILABLE");
    expect(result.semanticState).toBe("STALE");
    expect(result.predicted).toBe(false);
  });

  it("does not activate fallback without a packet", () => {
    const result = decideSemanticFallback("DISCONNECTED", null, now);

    expect(result.mode).toBe("UNAVAILABLE");
    expect(result.semanticState).toBe("UNAVAILABLE");
    expect(result.predicted).toBe(false);
  });
});
