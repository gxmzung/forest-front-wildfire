import type { ApiRecord } from "./forest-api";

export type TwinState = "LIVE" | "STALE" | "OFFLINE";

export function twinState(
  observedAt: unknown,
  receivedAt: unknown,
  now = Date.now(),
): TwinState {
  const observation =
    typeof observedAt === "string"
      ? Date.parse(observedAt)
      : NaN;

  const reception =
    typeof receivedAt === "string"
      ? Date.parse(receivedAt)
      : NaN;

  if (
    !Number.isFinite(observation) ||
    !Number.isFinite(reception)
  ) {
    return "OFFLINE";
  }

  const age =
    now - Math.min(observation, reception);

  return age >= 30_000
    ? "OFFLINE"
    : age >= 10_000
      ? "STALE"
      : "LIVE";
}

function record(value: unknown): ApiRecord {
  return (
    value &&
    typeof value === "object" &&
    !Array.isArray(value)
  )
    ? value as ApiRecord
    : {};
}

function finite(value: unknown): number | undefined {
  return (
    typeof value === "number" &&
    Number.isFinite(value)
  )
    ? value
    : undefined;
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function isUavAsset(asset: ApiRecord): boolean {
  return [
    "UAV",
    "MAIN_RELAY_DRONE",
    "SERVICE_RELAY_DRONE",
  ].includes(text(asset.assetType).toUpperCase());
}

export function isDemonstrationTelemetry(row: ApiRecord): boolean {
  const attributes = record(row.attributes);
  const identifiers = [
    row.assetId,
    row.sourceAssetId,
    row.assetCode,
  ].map(text);
  const provenance = [
    row.sourceSystem,
    row.evidenceScope,
    row.dataProvenance,
    attributes.sourceSystem,
    attributes.evidenceScope,
    attributes.dataProvenance,
    record(attributes.pathEvidence).uplinkSource,
    record(attributes.pathEvidence).transport,
  ]
    .map(text)
    .join(" ")
    .toUpperCase();

  return row.synthetic === true ||
    attributes.synthetic === true ||
    identifiers.some((value) => /^(SIM-|DEMO-)/i.test(value)) ||
    /(^|[_\s-])(DEMO|MOCK|SIMULATION|SYNTHETIC)([_\s-]|$)/.test(provenance);
}

export function isVerifiedOperatingDronePosition(row: ApiRecord): boolean {
  const attributes = record(row.attributes);
  const pathEvidence = record(attributes.pathEvidence);
  const positionSource = text(attributes.telemetryPositionSource).toUpperCase();
  const receivedAt = text(row.receivedAt);
  const coreReceivedAt = text(pathEvidence.coreReceivedAt);
  const gpsFixType = finite(attributes.gpsFixType);
  const positioningMethod = text(row.positioningMethod).toUpperCase();

  return text(row.assetType).toUpperCase() === "UAV" &&
    !isDemonstrationTelemetry(row) &&
    typeof row.latitude === "number" &&
    Number.isFinite(row.latitude) &&
    Math.abs(row.latitude) <= 90 &&
    typeof row.longitude === "number" &&
    Number.isFinite(row.longitude) &&
    Math.abs(row.longitude) <= 180 &&
    !(row.latitude === 0 && row.longitude === 0) &&
    typeof row.altitude === "number" &&
    Number.isFinite(row.altitude) &&
    typeof row.observedAt === "string" &&
    Number.isFinite(Date.parse(row.observedAt)) &&
    positionSource === "GLOBAL_POSITION_INT(33)" &&
    Number.isFinite(Date.parse(receivedAt)) &&
    Number.isFinite(Date.parse(coreReceivedAt)) &&
    (gpsFixType == null || gpsFixType >= 2) &&
    !["NO_FIX", "FIX_NOT_AVAILABLE"].includes(positioningMethod);
}

function normalizedPositioningMethod(
  telemetry: ApiRecord,
): string | undefined {
  const attrs = record(telemetry.attributes);
  const fixType = finite(attrs.gpsFixType);

  if (fixType === 6) return "RTK_FIXED";
  if (fixType === 5) return "RTK_FLOAT";
  if (fixType === 4) return "DGPS";
  if (fixType === 3) return "GNSS_3D";
  if (fixType === 2) return "GNSS_2D";

  if (fixType != null && fixType <= 1) {
    return "NO_FIX";
  }

  return typeof telemetry.positioningMethod === "string"
    ? telemetry.positioningMethod
    : undefined;
}

function normalizedHorizontalAccuracyM(
  telemetry: ApiRecord,
): number | undefined {
  const direct =
    finite(telemetry.horizontalAccuracyM);

  if (direct != null) {
    return direct;
  }

  const attrs = record(telemetry.attributes);

  return finite(attrs.horizontalAccuracy);
}

function validTelemetry(
  row: ApiRecord,
  eventId: string,
): boolean {
  return (
    row.eventId === eventId &&
    isVerifiedOperatingDronePosition(row)
  );
}

// 등록 장비만 실제 텔레메트리로 보강한다.
// 미등록 물리 ID는 별도 상태로 유지하며 중복 장비를 생성하지 않는다.
export function mergeDroneTwins(
  assets: ApiRecord[],
  telemetry: ApiRecord[],
  eventId: string,
  now = Date.now(),
) {
  const valid =
    telemetry.filter((row) =>
      validTelemetry(row, eventId)
    );

  const matched = new Set<ApiRecord>();

  const stateCounts: Record<TwinState, number> = {
    LIVE: 0,
    STALE: 0,
    OFFLINE: 0,
  };

  const rows = assets.map((asset) => {
    if (!isUavAsset(asset) || isDemonstrationTelemetry(asset)) {
      return asset;
    }
    const source =
      record(asset.specifications)
        .telemetrySourceAssetId;

    const candidates = valid.filter((row) => {
      const id =
        row.sourceAssetId ?? row.assetId;

      return (
        id === asset.assetId ||
        id === asset.assetCode ||
        (
          typeof source === "string" &&
          source === id
        )
      );
    });

    const value = candidates.sort(
      (a, b) =>
        Date.parse(String(b.observedAt)) -
        Date.parse(String(a.observedAt)),
    )[0];

    if (!value) {
      return asset;
    }

    const id =
      value.sourceAssetId ?? value.assetId;

    // 하나의 물리 ID가 여러 등록 장비에 매핑되면
    // 운영자 확인 전 자동 결합하지 않는다.
    if (
      assets.filter((other) =>
        id === other.assetId ||
        id === other.assetCode ||
        id ===
          record(other.specifications)
            .telemetrySourceAssetId
      ).length !== 1
    ) {
      return asset;
    }

    matched.add(value);

    const state = twinState(
      value.observedAt,
      value.receivedAt,
      now,
    );

    stateCounts[state] += 1;

    const valueAttributes =
      record(value.attributes);

    return {
      ...asset,

      geometry: {
        type: "Point",
        coordinates: [
          value.longitude,
          value.latitude,
          value.altitude,
        ],
      },

      observedAt: value.observedAt,
      receivedAt: value.receivedAt,
      sequence: value.sequence,

      operationalStatus:
        value.operationalStatus,

      batteryPct:
        value.batteryPct,

      packetLossPct:
        value.packetLossPct,

      positioningMethod:
        normalizedPositioningMethod(value),

      horizontalAccuracyM:
        normalizedHorizontalAccuracyM(value),

      qualityStatus: state,
      sourceSystem: "GCS_UPLINK",
      sourceAssetId: id,

      attributes: {
        ...record(asset.attributes),
        ...valueAttributes,

        digitalTwin: {
          ...record(
            valueAttributes.digitalTwin
          ),
          state,
        },
      },

      assetId: asset.assetId,
      assetCode: asset.assetCode,
      eventId: asset.eventId,
    };
  });

  return {
    assets: rows,
    matched: matched.size,
    unmatched: valid.length - matched.size,
    positionUnknown:
      assets.filter((asset) =>
        isUavAsset(asset) &&
        !isDemonstrationTelemetry(asset)
      ).length - matched.size,
    states: stateCounts,
  };
}

// API 장애 시 마지막 실제 위치를 잠깐 유지한다.
// DEMO 데이터는 이 캐시에 들어가지 않는다.
export class LiveDroneTelemetryReader {
  private cache =
    new Map<string, ApiRecord[]>();

  async read(
    eventId: string,
    demo: boolean,
    fetchRows: () => Promise<ApiRecord[]>,
  ) {
    if (demo) {
      return {
        rows: [] as ApiRecord[],
        status: "DEMO",
      };
    }

    try {
      const rows = await fetchRows();

      if (!Array.isArray(rows)) {
        throw new Error(
          "Invalid telemetry response"
        );
      }

      if (this.cache.size > 4) {
        this.cache.clear();
      }

      this.cache.set(eventId, rows);

      return {
        rows,
        status: "CONNECTED",
      };
    } catch {
      return {
        rows:
          this.cache.get(eventId) ?? [],
        status: "UNAVAILABLE",
      };
    }
  }
}
