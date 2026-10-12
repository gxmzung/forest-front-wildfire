import type { ApiRecord, EventOverview } from "../../http-api";
import { isDemonstrationTelemetry, twinState } from "../../http-api/live-drone-twin";

function record(value: unknown): ApiRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as ApiRecord
    : {};
}

function isLastKnownOperatingPosition(asset: ApiRecord) {
  return !isDemonstrationTelemetry(asset) &&
    record(asset.geometry).type === "Point";
}

export function markOperatingOverviewUnavailable(
  overview: EventOverview,
  message: string,
  now = Date.now(),
): EventOverview {
  let stale = 0;
  let offline = 0;
  let lastKnown = 0;

  const assets = overview.assets.map((asset) => {
    if (!isLastKnownOperatingPosition(asset)) return asset;

    const agedState = twinState(asset.observedAt, asset.receivedAt, now);
    const state = agedState === "OFFLINE" ? "OFFLINE" : "STALE";
    if (String(asset.assetType).toUpperCase() === "UAV") {
      if (state === "OFFLINE") offline += 1;
      else stale += 1;
      lastKnown += 1;
    }

    const attributes = record(asset.attributes);
    return {
      ...asset,
      qualityStatus: state,
      positionFetchStatus: state === "OFFLINE"
        ? "Core API 미연결 · 오래된 마지막 확인 위치"
        : "Core API 미연결 · 마지막 확인 위치",
      attributes: {
        ...attributes,
        digitalTwin: {
          ...record(attributes.digitalTwin),
          state,
        },
      },
    };
  });

  return {
    ...overview,
    assets,
    liveDroneTelemetry: overview.liveDroneTelemetry
      ? {
          ...overview.liveDroneTelemetry,
          status: "UNAVAILABLE",
          matched: 0,
          live: 0,
          stale,
          offline,
          lastKnown,
        }
      : undefined,
    kpis: [],
    kpiApiStatus: {
      state: "ERROR",
      checkedAt: new Date(now).toISOString(),
      message,
    },
  };
}
