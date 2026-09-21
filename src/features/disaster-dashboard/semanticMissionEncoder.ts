import type {
  SemanticMissionObservation,
  SemanticMissionPacket,
} from "./semanticMission";

export type SemanticMissionInput = {
  incidentId: string;
  assetId: string;
  observedAt: string;
  sourceBytes?: number;
  position?: {
    longitude: number;
    latitude: number;
    altitudeM?: number;
  };
  fire?: {
    detected: boolean;
    confidence: number;
    spreadDirection?: string;
    riskLevel?: string;
  };
  smoke?: {
    detected: boolean;
    confidence: number;
    density?: string;
  };
};

function attributes(
  values: Record<string, string | number | boolean | null | undefined>,
): Record<string, string | number | boolean | null> | undefined {
  const entries = Object.entries(values).filter(
    (entry): entry is [string, string | number | boolean | null] =>
      entry[1] !== undefined,
  );

  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
}

export function encodeSemanticMissionMock(
  input: SemanticMissionInput,
): SemanticMissionPacket {
  const observations: SemanticMissionObservation[] = [];

  if (input.fire) {
    observations.push({
      type: "FIRE",
      detected: input.fire.detected,
      confidence: input.fire.confidence,
      attributes: attributes({
        spreadDirection: input.fire.spreadDirection,
        riskLevel: input.fire.riskLevel,
      }),
    });
  }

  if (input.smoke) {
    observations.push({
      type: "SMOKE",
      detected: input.smoke.detected,
      confidence: input.smoke.confidence,
      attributes: attributes({
        density: input.smoke.density,
      }),
    });
  }

  return {
    schemaVersion: "SEMANTIC-MISSION/0.1",
    packetId: `POC-${input.assetId}-${input.observedAt}`,
    incidentId: input.incidentId,
    assetId: input.assetId,
    observedAt: input.observedAt,
    source: "MOCK",
    experimental: true,
    position: input.position,
    observations,
    sourceBytes: input.sourceBytes,
  };
}