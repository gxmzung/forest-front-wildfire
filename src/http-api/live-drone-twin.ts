import type { ApiRecord } from "./forest-api";

export type TwinState = "LIVE" | "STALE" | "OFFLINE";

export function twinState(observedAt: unknown, receivedAt: unknown, now = Date.now()): TwinState {
  const observation = typeof observedAt === "string" ? Date.parse(observedAt) : NaN;
  const reception = typeof receivedAt === "string" ? Date.parse(receivedAt) : NaN;
  if (!Number.isFinite(observation) || !Number.isFinite(reception)) return "OFFLINE";
  const age = now - Math.min(observation, reception);
  return age >= 30_000 ? "OFFLINE" : age >= 10_000 ? "STALE" : "LIVE";
}
function record(value: unknown): ApiRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as ApiRecord : {};
}
function validTelemetry(row: ApiRecord, eventId: string): boolean {
  return row.eventId === eventId && typeof row.latitude === "number" && Number.isFinite(row.latitude) && Math.abs(row.latitude) <= 90
    && typeof row.longitude === "number" && Number.isFinite(row.longitude) && Math.abs(row.longitude) <= 180
    && typeof row.altitude === "number" && Number.isFinite(row.altitude)
    && typeof row.observedAt === "string" && Number.isFinite(Date.parse(row.observedAt));
}
// Only registered assets are enriched; unmatched physical identities are reported, never inserted as duplicates.
export function mergeDroneTwins(assets: ApiRecord[], telemetry: ApiRecord[], eventId: string, now = Date.now()) {
  const valid = telemetry.filter(row => validTelemetry(row,eventId));
  const matched = new Set<ApiRecord>();
  const stateCounts: Record<TwinState, number> = {LIVE:0,STALE:0,OFFLINE:0};
  const rows = assets.map(asset => {
    const source = record(asset.specifications).telemetrySourceAssetId;
    const candidates = valid.filter(row => {
      const id = row.sourceAssetId ?? row.assetId;
      return id === asset.assetId || id === asset.assetCode || (typeof source === "string" && source === id);
    });
    const value = candidates.sort((a,b) => Date.parse(String(b.observedAt))-Date.parse(String(a.observedAt)))[0];
    if (!value) return asset;
    const id = value.sourceAssetId ?? value.assetId;
    // Ambiguous registry mappings require operator correction.
    if (assets.filter(other => id === other.assetId || id === other.assetCode || id === record(other.specifications).telemetrySourceAssetId).length !== 1) return asset;
    matched.add(value);
    const state = twinState(value.observedAt,value.receivedAt,now);
    stateCounts[state] += 1;
    return {...asset, geometry:{type:"Point",coordinates:[value.longitude,value.latitude,value.altitude]},
      observedAt:value.observedAt,receivedAt:value.receivedAt,sequence:value.sequence,
      operationalStatus:value.operationalStatus,batteryPct:value.batteryPct,positioningMethod:value.positioningMethod,
      horizontalAccuracyM:value.horizontalAccuracyM,qualityStatus:state,sourceSystem:"GCS_UPLINK",sourceAssetId:id,
      attributes:{...record(asset.attributes),...record(value.attributes),digitalTwin:{...record(record(value.attributes).digitalTwin),state}},
      assetId:asset.assetId,assetCode:asset.assetCode,eventId:asset.eventId};
  });
  return {assets:rows,matched:matched.size,unmatched:valid.length-matched.size,states:stateCounts};
}

// A short in-browser cache retains the last observed position during API failure.
// No simulated data enters this cache. Successful empty responses clear it.
export class LiveDroneTelemetryReader {
  private cache = new Map<string, ApiRecord[]>();
  async read(eventId: string, demo: boolean, fetchRows: () => Promise<ApiRecord[]>) {
    if (demo) return {rows:[] as ApiRecord[],status:"DEMO"};
    try {
      const rows = await fetchRows();
      if (!Array.isArray(rows)) throw new Error("Invalid telemetry response");
      if (this.cache.size > 4) this.cache.clear();
      this.cache.set(eventId,rows);
      return {rows,status:"CONNECTED"};
    } catch {
      return {rows:this.cache.get(eventId) ?? [],status:"UNAVAILABLE"};
    }
  }
}
