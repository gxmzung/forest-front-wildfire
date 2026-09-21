export type SemanticMissionState =
  | "DISABLED"
  | "EXPERIMENTAL"
  | "RECEIVING"
  | "STALE"
  | "UNAVAILABLE";

export type SemanticMissionSource =
  | "MOCK"
  | "VISION_MODEL"
  | "SENSOR_FUSION";

export type SemanticMissionPosition = {
  longitude: number;
  latitude: number;
  altitudeM?: number;
};

export type SemanticMissionObservation = {
  type: "FIRE" | "SMOKE" | "LANDSLIDE" | "ASSET" | "RISK";
  detected: boolean;
  confidence: number;
  attributes?: Record<string, string | number | boolean | null>;
};

export type SemanticMissionPacket = {
  schemaVersion: "SEMANTIC-MISSION/0.1";
  packetId: string;
  incidentId: string;
  assetId: string;
  observedAt: string;
  source: SemanticMissionSource;
  experimental: true;
  position?: SemanticMissionPosition;
  observations: SemanticMissionObservation[];
  sourceBytes?: number;
};

export type SemanticPacketMetrics = {
  packetBytes: number;
  sourceBytes: number | null;
  reductionRatio: number | null;
};

export function measureSemanticPacket(
  packet: SemanticMissionPacket,
): SemanticPacketMetrics {
  const packetBytes = new TextEncoder().encode(JSON.stringify(packet)).length;
  const sourceBytes =
    packet.sourceBytes != null &&
    Number.isFinite(packet.sourceBytes) &&
    packet.sourceBytes > 0
      ? packet.sourceBytes
      : null;

  return {
    packetBytes,
    sourceBytes,
    reductionRatio:
      sourceBytes == null ? null : packetBytes / sourceBytes,
  };
}

export function classifySemanticMissionState(
  packet: SemanticMissionPacket | null,
  now: Date,
  staleAfterMs = 10_000,
): SemanticMissionState {
  if (packet == null) return "UNAVAILABLE";

  const observedAtMs = Date.parse(packet.observedAt);
  if (!Number.isFinite(observedAtMs)) return "UNAVAILABLE";

  const ageMs = Math.max(0, now.getTime() - observedAtMs);
  return ageMs > staleAfterMs ? "STALE" : "RECEIVING";
}

export function isSemanticMissionPacketValid(
  packet: SemanticMissionPacket,
): boolean {
  if (packet.schemaVersion !== "SEMANTIC-MISSION/0.1") return false;
  if (packet.experimental !== true) return false;
  if (!packet.packetId || !packet.incidentId || !packet.assetId) return false;
  if (!Number.isFinite(Date.parse(packet.observedAt))) return false;

  if (packet.position) {
    if (
      !Number.isFinite(packet.position.longitude) ||
      !Number.isFinite(packet.position.latitude) ||
      packet.position.longitude < -180 ||
      packet.position.longitude > 180 ||
      packet.position.latitude < -90 ||
      packet.position.latitude > 90
    ) {
      return false;
    }
  }

  return packet.observations.every(
    (observation) =>
      Number.isFinite(observation.confidence) &&
      observation.confidence >= 0 &&
      observation.confidence <= 1,
  );
}