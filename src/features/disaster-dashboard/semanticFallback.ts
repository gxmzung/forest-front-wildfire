import type { LinkHealth } from "./operationalEvidence";
import {
  isSemanticMissionPacketValid,
  type SemanticMissionPacket,
  type SemanticMissionState,
} from "./semanticMission";
import { createSemanticMissionSnapshot } from "./semanticMissionSimulator";

export type SemanticFallbackMode =
  | "LIVE"
  | "DEGRADED"
  | "SEMANTIC_POC"
  | "UNAVAILABLE";

export type SemanticFallbackDecision = {
  mode: SemanticFallbackMode;
  linkHealth: LinkHealth;
  semanticState: SemanticMissionState;
  packet: SemanticMissionPacket | null;
  experimental: true;
  mock: boolean;
  predicted: boolean;
  reason: string;
};

export function decideSemanticFallback(
  linkHealth: LinkHealth,
  packet: SemanticMissionPacket | null,
  now: Date,
  staleAfterMs = 10_000,
): SemanticFallbackDecision {
  const validPacket =
    packet != null && isSemanticMissionPacketValid(packet)
      ? packet
      : null;

  const snapshot = createSemanticMissionSnapshot(
    validPacket,
    now,
    staleAfterMs,
  );

  if (linkHealth === "CONNECTED") {
    return {
      mode: "LIVE",
      linkHealth,
      semanticState: snapshot.state,
      packet: validPacket,
      experimental: true,
      mock: validPacket?.source === "MOCK",
      predicted: false,
      reason: "??? ?? ?? ??",
    };
  }

  if (linkHealth === "DELAYED") {
    return {
      mode: "DEGRADED",
      linkHealth,
      semanticState: snapshot.state,
      packet: validPacket,
      experimental: true,
      mock: validPacket?.source === "MOCK",
      predicted: false,
      reason: "??? ?? ?? ??",
    };
  }

  if (validPacket != null && snapshot.state === "RECEIVING") {
    return {
      mode: "SEMANTIC_POC",
      linkHealth,
      semanticState: snapshot.state,
      packet: validPacket,
      experimental: true,
      mock: validPacket.source === "MOCK",
      predicted: true,
      reason: "?? ?? ???? ??? Semantic Mission PoC ?? ??",
    };
  }

  return {
    mode: "UNAVAILABLE",
    linkHealth,
    semanticState: snapshot.state,
    packet: validPacket,
    experimental: true,
    mock: validPacket?.source === "MOCK",
    predicted: false,
    reason: "?? ?? ???? ?? ??? Semantic Mission PoC ?? ??",
  };
}
