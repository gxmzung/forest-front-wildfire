import { DroneTwinDetail } from "./DroneTwinDetail";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { externalDisasterApi, loadDashboardDisasterAssetsCached, loadEventOverview, loadEventTimeline, type ApiRecord, type EventOverview, type EventTimeline, type ForestEvent } from "../../http-api";
import { forestApi } from "../../http-api/forest-api";
import { isLocalE2EMode, LOCAL_E2E_EVENT } from "../../http-api/local-e2e";
import { fieldCoreStatusLabel, fieldEvent, isFieldPreviewMode, isLocalFieldMode } from "../../http-api/field-mode";
import SemanticMissionPocPanel from "./SemanticMissionPocPanel";
import { decideSemanticFallback } from "./semanticFallback";
import { encodeSemanticMissionMock } from "./semanticMissionEncoder";
import LivePositionMap from "./LivePositionMap";
import MapTimelinePlayer, { type MapTimelineSnapshot } from "./MapTimelinePlayer";
import {
  OperationsPanel,
  type ExternalIntegrationStatus,
  type PanelTab,
} from "./OperationsPanel";

import DroneVideoModal from "./DroneVideoModal";
import VideoPlayback from "./VideoPlayback";
import FieldLinkChatWidget from "./FieldLinkChatWidget";
import type { VideoPlaybackState } from "./videoPlaybackState";
import RequirementsReadinessModal from "./RequirementsReadinessModal";
import { createDemoOverview, DEMO_EVENT, DEMO_SCENARIOS, demoScenarioFromLocation } from "./demoOverview";
import { applyTelemetrySafetyRules, TelemetryStreamClient, type TelemetryStreamStatus } from "./telemetryStream";
import { calculatePacketSequence, calculateTelemetryMetrics, classifyLinkHealth, type TelemetrySample } from "./operationalEvidence";
import { evaluateFieldApiHealth, fieldApiHealthLabel, formatLastSuccessAge } from "./fieldApiHealth";
import { PROJECT_ENHANCED_TARGET } from "./officialRfpGaps";
import { pickSlenoRtkFocusCenter } from "./slenoMapFocus";
import {
  displayProfileClassName,
  getDisplayProfileConfig,
  parseDisplayProfile,
} from "./displayProfile";
import "./unified-disaster-dashboard.css";
import "./field-header-hotfix.css";
import "./field-interaction-hotfix.css";

const POLL_INTERVAL_MS = 1_000;
const DEFAULT_CHANGE_HIGHLIGHT_MS = POLL_INTERVAL_MS * 0.3;
const DEFAULT_EVENT_ID =
  import.meta.env.VITE_DEFAULT_EVENT_ID?.trim() ||
  "10000000-0000-4000-8000-000000000001";
const FORCE_DEMO_MODE = new URLSearchParams(window.location.search).get("demo") === "1";
const FORCE_LOCAL_E2E_MODE = isLocalE2EMode();
const FORCE_LOCAL_FIELD_MODE = isLocalFieldMode() || new URLSearchParams(window.location.search).get("field") === "1";
const FORCE_FIELD_PREVIEW_MODE = FORCE_LOCAL_FIELD_MODE && (isFieldPreviewMode() || new URLSearchParams(window.location.search).get("preview") === "1");

/*
 * 理쒖쥌 ?댁쁺 ?붾㈃?먯꽌??DEMO/KPI/PoC 寃利?UI瑜??몄텧?섏? ?딅뒗??
 * ?꾩슂 ???debug=1 ?먯꽌留?媛쒕컻 寃利?UI瑜??ㅼ떆 ?뺤씤?????덈떎.
 */
const SHOW_VALIDATION_UI =
  !FORCE_DEMO_MODE ||
  new URLSearchParams(window.location.search).get("debug") === "1";

function text(value: unknown, fallback = "-") { return value == null || value === "" ? fallback : String(value); }
const koreanLabels: Record<string, string> = {
  WILDFIRE: "?곕텋",
  LANDSLIDE: "?곗궗??,
  COMPLEX: "蹂듯빀 ?щ궃",
  RESPONDING: "???以?,
  CLOSED: "醫낅즺",
  READY: "?湲?,
  ACTIVE: "?쒖꽦",
  INACTIVE: "鍮꾪솢??,
  RESOLVED: "?댁젣",
  FLYING: "鍮꾪뻾 以?,
  TAKING_OFF: "?대쪠 以?,
  RETURNING: "蹂듦? 以?,
  MOVING: "?대룞 以?,
  PATROLLING: "?쒖같 以?,
  SEARCHING: "?섏깋 以?,
  APPROACHING: "?묎렐 以?,
  EVACUATING: "???以?,
  HOLDING: "?꾩옣 ?湲?,
  STOPPED: "?뺤?",
  SAFE: "?덉쟾",
  CAUTION: "二쇱쓽",
  WARNING: "寃쎄퀎",
  CRITICAL: "?ш컖",
  SEVERE: "?꾪뿕",
  MODERATE: "蹂댄넻",
  LOW: "??쓬",
  NORMAL: "?뺤긽",
  DEGRADED: "?깅뒫 ???,
  DEPLOYING: "援ъ텞 以?,
  CALIBRATING: "蹂댁젙 以?,
  SIGNAL_LOST: "?좏샇 ?딄?",
  BOOTING: "?쒖옉 以?,
  FAILED: "怨좎옣",
  UNKNOWN: "?뺤씤 ?꾩슂",
  RTK_FIXED: "RTK FIX 쨌 蹂댁젙 ?덉젙",
  RTK_FLOAT: "RTK FLOAT 쨌 蹂댁젙 以?,
  GNSS: "?쇰컲 GNSS",
  NETWORK: "?ㅽ듃?뚰겕 痢≪쐞",
  VALIDATED: "寃利??꾨즺",
  RAW: "?먯떆 ?섏떊",
  REJECTED: "?ъ슜 ?쒖쇅",
};
function korean(value: unknown, fallback = "-") {
  const raw = text(value, fallback);
  return koreanLabels[raw] ?? raw.replaceAll("_", " ");
}
const assetTypeLabels: Record<string, string> = {
  PERSONNEL: "?몄썝",
  UAV: "臾댁씤湲?,
  RTK_BASE_LPWA_GATEWAY: "?대룞??RTK 湲곗?援?텹PWA 寃뚯씠?몄썾??,
  TVWS_BASE_STATION: "TVWS 湲곗?援?,
  TVWS_CPE: "TVWS CPE",
  LTE_GATEWAY: "LTE 寃뚯씠?몄썾??,
  COMMAND_VEHICLE: "吏??李⑤웾",
  RTK_TERMINAL: "RTK ?⑤쭚",
  PRIVATE_5G_NTN_GATEWAY: "?뱁솕留?5G쨌?沅ㅻ룄 ?꾩꽦 寃뚯씠?몄썾??,
  RADIO_GATEWAY_400MHZ: "400MHz 臾댁쟾 寃뚯씠?몄썾??,
  MAIN_RELAY_DRONE: "二?以묎퀎 ?쒕줎",
  SERVICE_RELAY_DRONE: "?쒕퉬??以묎퀎 ?쒕줎",
  FIXED_RELAY: "怨좎젙???꾩떆 以묎퀎湲?,
  GCS: "?쒕줎 吏?곹넻?쒖옣移?GCS)",
  REF_AP: "湲곗? AP",
  ROVER_AP: "?대룞 AP",
  IR_UWB_GPR: "IR-UWB쨌GPR ?먯? ?λ퉬",
  MOBILE_RELAY: "?대룞 以묎퀎湲?,
  RSSI_DETECTOR: "RSSI ?먯?湲?,
  ASSET: "?λ퉬",
};
function assetTypeLabel(value: string) { return assetTypeLabels[value] ?? value.replaceAll("_", " "); }
export type ResourceGroup = "PERSONNEL" | "UAV" | "COMMAND" | "POSITIONING" | "COMMUNICATION" | "DETECTION" | "UNASSIGNED";
const resourceGroupLabels: Record<ResourceGroup, string> = {
  PERSONNEL: "?몄썝", UAV: "臾댁씤湲?, COMMAND: "吏???λ퉬", POSITIONING: "?꾩튂 ?λ퉬",
  COMMUNICATION: "?듭떊 ?λ퉬", DETECTION: "?먯? ?λ퉬", UNASSIGNED: "誘몃벑濡??λ퉬",
};
function resourceGroupOf(item: LiveLocation): ResourceGroup {
  if (item.kind === "personnel") return "PERSONNEL";
  if (!item.registeredToEvent) return "UNASSIGNED";
  if (["UAV", "MAIN_RELAY_DRONE", "SERVICE_RELAY_DRONE"].includes(item.category)) return "UAV";
  if (["COMMAND_VEHICLE", "GCS"].includes(item.category)) return "COMMAND";
  if (["RTK_TERMINAL", "RTK_BASE_LPWA_GATEWAY"].includes(item.category)) return "POSITIONING";
  if (["TVWS_BASE_STATION", "TVWS_CPE", "LTE_GATEWAY", "PRIVATE_5G_NTN_GATEWAY", "RADIO_GATEWAY_400MHZ", "FIXED_RELAY", "MOBILE_RELAY", "REF_AP", "ROVER_AP"].includes(item.category)) return "COMMUNICATION";
  if (["RSSI_DETECTOR", "IR_UWB_GPR"].includes(item.category)) return "DETECTION";
  return "UNASSIGNED";
}
function relativeTime(value: unknown) {
  if (!value) return "?섏떊 ?쒓컖 ?놁쓬";
  const elapsedSeconds = Math.max(0, Math.floor((Date.now() - new Date(String(value)).getTime()) / 1000));
  if (elapsedSeconds < 10) return "諛⑷툑 ??;
  if (elapsedSeconds < 60) return `${elapsedSeconds}珥???;
  const minutes = Math.floor(elapsedSeconds / 60);
  if (minutes < 60) return `${minutes}遺???;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}?쒓컙 ??;
  return `${Math.floor(hours / 24)}????;
}

export type LiveLocation = {
  id: string;
  kind: "personnel" | "asset";
  label: string;
  status: string;
  longitude: number;
  latitude: number;
  altitude: number | null;
  observedAt: string;
  category: string;
  batteryPct: number | null;
  signalStrengthDbm: number | null;
  snrDb: number | null;
  latencyMs: number | null;
  packetLossPct: number | null;
  safetyStatus: string;
  sourceSystem: string;
  positioningMethod: string | null;
  horizontalAccuracyM: number | null;
  qualityStatus: string;
  sourceAssetId: string;
  reportedByAssetId: string;
  reportingRole: string;
  rtcmStatus: string | null;
  networkMode: string | null;
  expectedTelemetryIntervalSec: number | null;
  flightMode: string | null;
  armed: boolean | null;
  missionSequence: number | null;
  emergencyStatus: string | null;
  groundSpeedMps: number | null;
  headingDeg: number | null;
  registeredToEvent: boolean;

  pathEvidence: {
    uplinkReceivedAt: string | null;
    uplinkForwardStartedAt: string | null;
    uplinkSource: string | null;
    uplinkBytes: number | null;
    transport: string | null;
    coreReceivedAt: string | null;
  } | null;
};

function locationFrom(item: Record<string, unknown>, kind: LiveLocation["kind"]): LiveLocation | null {
  const geometry = item.geometry as { coordinates?: unknown[] } | undefined;
  const coordinates = geometry?.coordinates;
  const longitude = Number(coordinates?.[0]);
  const latitude = Number(coordinates?.[1]);
  if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) return null;
  const altitudeValue = Number(coordinates?.[2]);
  const attributes = item.attributes && typeof item.attributes === "object"
    ? item.attributes as Record<string, unknown>
    : {};
  const specifications = item.specifications && typeof item.specifications === "object"
    ? item.specifications as Record<string, unknown>
    : {};

  const linkQuality =
    attributes.linkQuality &&
    typeof attributes.linkQuality === "object" &&
    !Array.isArray(attributes.linkQuality)
      ? attributes.linkQuality as Record<string, unknown>
      : {};

  const rawPathEvidence =
    attributes.pathEvidence &&
    typeof attributes.pathEvidence === "object" &&
    !Array.isArray(attributes.pathEvidence)
      ? attributes.pathEvidence as Record<string, unknown>
      : null;

  const pathBytes =
    Number(rawPathEvidence?.uplinkBytes);

  const pathEvidence = rawPathEvidence
    ? {
        uplinkReceivedAt:
          rawPathEvidence.uplinkReceivedAt == null
            ? null
            : String(rawPathEvidence.uplinkReceivedAt),

        uplinkForwardStartedAt:
          rawPathEvidence.uplinkForwardStartedAt == null
            ? null
            : String(rawPathEvidence.uplinkForwardStartedAt),

        uplinkSource:
          rawPathEvidence.uplinkSource == null
            ? null
            : String(rawPathEvidence.uplinkSource),

        uplinkBytes:
          Number.isFinite(pathBytes)
            ? pathBytes
            : null,

        transport:
          rawPathEvidence.transport == null
            ? null
            : String(rawPathEvidence.transport),

        coreReceivedAt:
          rawPathEvidence.coreReceivedAt == null
            ? null
            : String(rawPathEvidence.coreReceivedAt),
      }
    : null;
  const horizontalAccuracyM = Number(item.horizontalAccuracyM);
  const expectedTelemetryIntervalSec = Number(
    item.expectedTelemetryIntervalSec
    ?? attributes.expectedTelemetryIntervalSec
    ?? attributes.reportingIntervalSec
    ?? specifications.targetUpdateSeconds,
  );
  return {
    id: String(kind === "personnel" ? item.personExternalId : item.assetId),
    kind,
    label: String(kind === "personnel" ? item.personExternalId : item.assetName ?? item.assetCode ?? item.assetId),
    status: korean(kind === "personnel" ? item.activityStatus ?? item.safetyStatus : item.operationalStatus),
    longitude,
    latitude,
    altitude: Number.isFinite(altitudeValue) ? altitudeValue : null,
    observedAt: String(item.observedAt ?? ""),
    category: String(kind === "personnel" ? "PERSONNEL" : item.assetType ?? "ASSET"),
    batteryPct: (item.batteryPct != null && Number.isFinite(Number(item.batteryPct))) ? Number(item.batteryPct) : null,
    signalStrengthDbm:
      Number.isFinite(Number(item.signalStrengthDbm ?? linkQuality.rssiDbm))
        ? Number(item.signalStrengthDbm ?? linkQuality.rssiDbm)
        : null,

    snrDb:
      Number.isFinite(Number(linkQuality.snrDb))
        ? Number(linkQuality.snrDb)
        : null,

    latencyMs: (item.latencyMs != null && Number.isFinite(Number(item.latencyMs))) ? Number(item.latencyMs) : null,
    packetLossPct: (item.packetLossPct != null && Number.isFinite(Number(item.packetLossPct))) ? Number(item.packetLossPct) : null,
    safetyStatus: korean(item.safetyStatus ?? "UNKNOWN"),
    sourceSystem: String(item.sourceSystem ?? ""),
    positioningMethod: item.positioningMethod || attributes.positionFix
      ? String(item.positioningMethod ?? attributes.positionFix)
      : null,
    horizontalAccuracyM: Number.isFinite(horizontalAccuracyM) ? horizontalAccuracyM : null,
    qualityStatus: String(item.qualityStatus ?? ""),
    sourceAssetId: String(item.sourceAssetId ?? ""),
    reportedByAssetId: String(item.reportedByAssetId ?? ""),
    reportingRole: String(item.reportingRole ?? ""),
    rtcmStatus: attributes.correction ? String(attributes.correction) : null,
    networkMode:
      item.activeLink ||
      item.networkMode ||
      attributes.network ||
      attributes.networkType ||
      pathEvidence?.transport
        ? String(
            item.activeLink ??
            item.networkMode ??
            attributes.network ??
            attributes.networkType ??
            pathEvidence?.transport
          )
        : null,
    expectedTelemetryIntervalSec: Number.isFinite(expectedTelemetryIntervalSec) && expectedTelemetryIntervalSec > 0
      ? expectedTelemetryIntervalSec
      : null,
    flightMode: attributes.flightMode == null ? null : String(attributes.flightMode),
    armed: typeof attributes.armed === "boolean" ? attributes.armed : null,
    missionSequence: (attributes.missionSequence != null && Number.isFinite(Number(attributes.missionSequence))) ? Number(attributes.missionSequence) : null,
    emergencyStatus: attributes.emergencyStatus == null ? null : String(attributes.emergencyStatus),
    groundSpeedMps: (attributes.groundSpeedMps != null && Number.isFinite(Number(attributes.groundSpeedMps))) ? Number(attributes.groundSpeedMps) : null,
    headingDeg: (attributes.headingDeg != null && Number.isFinite(Number(attributes.headingDeg))) ? Number(attributes.headingDeg) : null,
    registeredToEvent: kind === "personnel" || item.eventRegistrationStatus !== "UNREGISTERED",

    pathEvidence,
  };
}

function locationKey(item: LiveLocation) { return `${item.kind}-${item.id}`; }
function locationFingerprint(item: LiveLocation) {
  return [
    item.longitude, item.latitude, item.altitude, item.status, item.observedAt,
    item.positioningMethod, item.horizontalAccuracyM, item.rtcmStatus,
    item.pathEvidence?.coreReceivedAt,
  ].join("|");
}

function overviewKpiValue(overview: EventOverview, metricCode: string): number | null {
  const row = overview.kpis.find((item) => String(item.metricCode ?? "") === metricCode);
  const candidate = Number(row?.measuredValue);
  return Number.isFinite(candidate) ? candidate : null;
}

function fieldKpiState(value: number | null, target: number, direction: "MAX" | "MIN") {
  if (value == null) return "WAIT" as const;
  return (direction === "MAX" ? value <= target : value >= target) ? "PASS" as const : "CHECK" as const;
}

function telemetrySampleFromLiveAsset(asset: ApiRecord): TelemetrySample | null {
  if (asset.sourceSystem !== "GCS_UPLINK") return null;
  const geometry = asset.geometry as { coordinates?: unknown[] } | undefined;
  const coordinates = geometry?.coordinates;
  const longitude = Number(coordinates?.[0]);
  const latitude = Number(coordinates?.[1]);
  const observedAt = typeof asset.observedAt === "string" ? asset.observedAt : "";
  const receivedAt = typeof asset.receivedAt === "string" ? asset.receivedAt : "";
  if (!Number.isFinite(longitude) || !Number.isFinite(latitude) || !observedAt || !receivedAt) return null;
  return {
    assetId: String(asset.assetId ?? ""),
    entityType: "ASSET",
    assetType: String(asset.assetType ?? "UAV"),
    observedAt,
    receivedAt,
    sequence: asset.sequence != null && Number.isFinite(Number(asset.sequence)) ? Number(asset.sequence) : undefined,
    latitude,
    longitude,
  };
}

function isPositioningLocation(location: LiveLocation) {
  return location.kind === "personnel"
    || ["RTK_TERMINAL", "RTK_BASE_LPWA_GATEWAY"].includes(location.category);
}

type CommunicationPath = {
  nodes: string[];
  links: Array<{ label: string; medium: "wired" | "wireless" }>;
};

function communicationPath(location: LiveLocation): CommunicationPath | null {
  if (location.kind === "personnel" || location.category === "RTK_TERMINAL") {
    const accessNetwork = location.networkMode || "LPWA";
    if (location.reportedByAssetId) {
      return {
        nodes: ["???RTK ?⑤쭚", `${korean(location.reportingRole || "GATEWAY")} 吏묎퀎`, "?듯빀 API쨌?대씪?곕뱶"],
        links: [
          { label: accessNetwork, medium: "wireless" },
          { label: "HTTPS쨌JSON", medium: "wired" },
        ],
      };
    }
    return {
      nodes: ["???RTK ?⑤쭚", "LPWA 寃뚯씠?몄썾??, "諛깊? 寃뚯씠?몄썾??, "?듯빀愿??],
      links: [
        { label: "LPWA", medium: "wireless" },
        { label: "Ethernet", medium: "wired" },
        { label: "LTE쨌5G쨌LEO", medium: "wireless" },
      ],
    };
  }
  if (location.category === "RTK_BASE_LPWA_GATEWAY") {
    return {
      nodes: ["????⑤쭚", "RTK 湲곗?援?텹PWA GW", "TVWS쨌諛깊? ?λ퉬", "?듯빀愿??],
      links: [
        { label: "LPWA", medium: "wireless" },
        { label: "Ethernet", medium: "wired" },
        { label: "LTE쨌5G쨌LEO", medium: "wireless" },
      ],
    };
  }
  if (location.category === "TVWS_CPE") {
    return {
      nodes: ["?꾩옣 ?λ퉬쨌LPWA GW", "TVWS CPE", "TVWS 湲곗?援?, "諛깊? GW"],
      links: [
        { label: "Ethernet", medium: "wired" },
        { label: "TVWS", medium: "wireless" },
        { label: "Ethernet", medium: "wired" },
      ],
    };
  }
  if (location.category === "TVWS_BASE_STATION") {
    return {
      nodes: ["?꾩옣 TVWS CPE", "TVWS 湲곗?援?, "L3 ?ㅼ쐞移샕룸갚? GW", "?듯빀愿??],
      links: [
        { label: "TVWS", medium: "wireless" },
        { label: "Ethernet", medium: "wired" },
        { label: "LTE쨌5G쨌LEO", medium: "wireless" },
      ],
    };
  }
  if (["LTE_GATEWAY", "PRIVATE_5G_NTN_GATEWAY"].includes(location.category)) {
    return {
      nodes: ["?꾩옣 IP ?λ퉬", assetTypeLabel(location.category), "?듯빀愿??],
      links: [
        { label: "Ethernet", medium: "wired" },
        { label: location.category === "LTE_GATEWAY" ? "LTE" : "5G쨌LEO", medium: "wireless" },
      ],
    };
  }
  if (location.category === "COMMAND_VEHICLE") {
    return {
      nodes: ["?꾩옣 寃뚯씠?몄썾??, "李⑤웾 L3 ?ㅼ쐞移?, "諛깊? 寃뚯씠?몄썾??, "?듯빀愿??],
      links: [
        { label: "Ethernet", medium: "wired" },
        { label: "Ethernet", medium: "wired" },
        { label: "LTE쨌5G쨌LEO", medium: "wireless" },
      ],
    };
  }
  if (resourceGroupOf(location) === "COMMUNICATION") {
    return {
      nodes: ["?꾩옣 ?λ퉬", assetTypeLabel(location.category), "?곸쐞 寃뚯씠?몄썾??, "?듯빀愿??],
      links: [
        { label: "?꾩옣 臾댁꽑", medium: "wireless" },
        { label: "Ethernet", medium: "wired" },
        { label: "諛깊? 臾댁꽑", medium: "wireless" },
      ],
    };
  }
  return null;
}

function correctionStatus(location: LiveLocation) {
  if (location.category === "RTK_BASE_LPWA_GATEWAY") {
    return location.rtcmStatus === "READY" ? "RTCM ?앹꽦쨌?≪텧 以鍮? : location.rtcmStatus ? korean(location.rtcmStatus) : "?곹깭 ?섏떊 ??;
  }
  if (location.positioningMethod === "RTK_FIXED") return "RTCM ?곸슜 쨌 怨좎젙??;
  if (location.positioningMethod === "RTK_FLOAT") return "RTCM ?곸슜 쨌 ?좊룞??;
  if (location.positioningMethod === "GNSS") return "湲곗?援?蹂댁젙 誘몄쟻??;
  return "蹂댁젙 ?곹깭 ?뺤씤 遺덇?";
}

function positioningDescription(location: LiveLocation) {
  if (location.category === "RTK_BASE_LPWA_GATEWAY") {
    return "湲곗?援?? ?뺥솗??湲곗?醫뚰몴? GNSS 愿痢↔컪??李⑥씠濡?RTCM 蹂댁젙?뺣낫瑜?留뚮벊?덈떎. ????곹깭??LPWA瑜?湲곕낯 ?꾩옣留앹쑝濡?怨듭쑀?섍퀬, LPWA ?뚯쁺吏??뿉??LTE 蹂댁“留앹쑝濡??꾪솚?⑸땲??";
  }
  return "?⑤쭚??GNSS ?꾩꽦?좏샇? 湲곗?援?쓽 RTCM 蹂댁젙?뺣낫瑜?寃고빀???꾩튂瑜?怨꾩궛?⑸땲?? ?쒖떆 ?꾩튂??痢≪쐞 ?곹깭? ?덉긽 ?ㅼ감瑜??④퍡 ?뺤씤?댁빞 ?⑸땲??";
}

type PositioningWarning = {
  level: "caution" | "critical";
  title: string;
  message: string;
  action: string;
};

function positioningWarning(location: LiveLocation): PositioningWarning | null {
  if (location.category === "RTK_BASE_LPWA_GATEWAY") {
    if (location.rtcmStatus === "READY") return null;
    return {
      level: "critical",
      title: "RTCM 蹂댁젙?뺣낫瑜??≪텧?????놁뒿?덈떎",
      message: "?꾩옱 湲곗?援??곹깭濡쒕뒗 ????⑤쭚???뺣? ?꾩튂瑜?蹂댁옣?????놁뒿?덈떎.",
      action: "湲곗?援?醫뚰몴? GNSS ?섏떊?곹깭, RTCM ?곕룞???뺤씤?섍퀬 ????⑤쭚??LPWA 湲곕낯留?諛?LTE 蹂댁“留??곹깭瑜?媛곴컖 ?먭???二쇱꽭??",
    };
  }
  if (location.positioningMethod === "RTK_FIXED" && location.horizontalAccuracyM != null) return null;
  if (location.positioningMethod === "RTK_FLOAT") {
    return {
      level: "caution",
      title: "RTK 蹂댁젙???꾩쭅 ?덉젙?섏? ?딆븯?듬땲??,
      message: "FLOAT ?곹깭???꾩튂??FIX ?곹깭蹂대떎 ?ㅼ감媛 ?щ?濡??뺥솗??援ъ“쨌吏???꾩튂濡??뺤젙?댁꽌?????⑸땲??",
      action: "湲곗?援?嫄곕━쨌?꾩꽦 ?샕텹PWA ?섏떊?곹깭瑜??뺤씤?섍퀬 RTCM 蹂댁젙?뺣낫媛 ?덉젙???뚭퉴吏 湲곕떎??二쇱꽭??",
    };
  }
  if (location.positioningMethod === "GNSS") {
    return {
      level: "critical",
      title: "蹂댁젙移섍? ?녿뒗 ?쇰컲 GNSS ?꾩튂?낅땲??,
      message: "?쒖떆 醫뚰몴??湲곗?援?蹂댁젙???곸슜?섏? ?딆븘 ?뺥솗???좊ː?????덈뒗 ?뺣? ?꾩튂媛 ?꾨떃?덈떎.",
      action: "RTK 湲곗?援?쓽 RTCM 蹂댁젙 ?곌껐???뺤씤?섍퀬, ?꾩튂 怨듭쑀 寃쎈줈??LPWA 湲곕낯留앷낵 LTE 蹂댁“留앹쑝濡?援щ텇???먭???二쇱꽭??",
    };
  }
  if (location.positioningMethod === "RTK_FIXED" && location.horizontalAccuracyM == null) {
    return {
      level: "caution",
      title: "?꾩튂 ?ㅼ감媛믪쓣 ?뺤씤?????놁뒿?덈떎",
      message: "RTK FIX ?곹깭?댁?留??뺥솗??媛믪씠 ?놁뼱 ?쒖떆 ?꾩튂???좊ː ?섏???寃利앺븷 ???놁뒿?덈떎.",
      action: "RTK ?⑤쭚?먯꽌 horizontalAccuracyM ???꾨줈?좎퐳 ?꾩닔 痢≪쐞 ?덉쭏媛믪쓣 ?④퍡 ?꾩넚??二쇱꽭??",
    };
  }
  return {
    level: "critical",
    title: "痢≪쐞쨌蹂댁젙 ?곹깭媛 ?뺤씤?섏? ?딆븯?듬땲??,
    message: "蹂댁젙 ?곸슜 ?щ?瑜??????놁뼱 ?쒖떆 醫뚰몴瑜??뺥솗???꾩튂濡??좊ː?????놁뒿?덈떎.",
    action: "RTK 湲곗?援?쓽 蹂댁젙 ?곌껐怨?positioningMethod쨌horizontalAccuracyM???뺤씤?섍퀬, primaryLink쨌activeLink쨌fallbackActivated瑜??듭떊 洹쒖빟??留욊쾶 ?낅젰??二쇱꽭??",
  };
}

type CommunicationProfile = {
  scope: string;
  role: string;
  carries: string;
  path: string;
};

function communicationProfile(location: LiveLocation): CommunicationProfile | null {
  if (["RTK_TERMINAL", "RTK_BASE_LPWA_GATEWAY"].includes(location.category)) {
    return {
      scope: "?꾩옣 ??띾쭩",
      role: "LPWA",
      carries: "RTCM 蹂댁젙?뺣낫쨌????꾩튂쨌諛고꽣由?룸퉬?곸떊??,
      path: "RTK ?⑤쭚 ??LPWA 寃뚯씠?몄썾????吏?섏감??,
    };
  }
  if (location.category === "PRIVATE_5G_NTN_GATEWAY") {
    return {
      scope: "?꾩옣 怨좎냽留?+ 鍮꾩긽 ?몃??곌껐",
      role: "?댁쓬5G쨌LEO 寃뚯씠?몄썾??,
      carries: "?쒕줎 ?곸긽쨌?ъ쭊쨌吏?꽷룻쁽???낅Т ?곗씠??,
      path: "?쒕줎쨌移대찓?????댁쓬5G ??吏?섏감????LEO/LTE ???대씪?곕뱶",
    };
  }
  if (location.category === "LTE_GATEWAY") {
    return {
      scope: "?몃? ?곌껐留?,
      role: "?듭떊??LTE 諛깊?",
      carries: "?꾩튂쨌?곹깭쨌?곸긽쨌?낅Т ?곗씠??,
      path: "?⑤쭚 ?먮뒗 吏?섏감????LTE ???대씪?곕뱶",
    };
  }
  if (["TVWS_BASE_STATION", "TVWS_CPE"].includes(location.category)) {
    return {
      scope: "?κ굅由??꾩옣?곌껐쨌諛깊?",
      role: "TVWS Base쨌CPE",
      carries: "李⑤웾쨌以묎퀎?λ퉬 媛??곗씠?곗? ?몃?留??곌껐 ?몃옒??,
      path: "?꾩옣 以묎퀎湲걔룹쭊?붿감????TVWS ??吏?섏감?됀룹쇅遺留?,
    };
  }
  if (location.category === "RADIO_GATEWAY_400MHZ") {
    return {
      scope: "?꾩옣 ?뚯꽦留?,
      role: "400MHz ?묐갑??臾댁쟾",
      carries: "????뚯꽦쨌湲닿툒 ?몄텧",
      path: "???臾댁쟾湲???臾댁쟾 寃뚯씠?몄썾????吏?섎?",
    };
  }
  if (["MAIN_RELAY_DRONE", "SERVICE_RELAY_DRONE", "FIXED_RELAY", "MOBILE_RELAY"].includes(location.category)) {
    return {
      scope: "?꾩옣 以묎퀎留?,
      role: "怨듭쨷쨌吏??以묎퀎湲?,
      carries: "?꾩옣 ?⑤쭚???듭떊 ?좏샇? ?곹깭?뺣낫",
      path: "??먃룹꽱????以묎퀎湲???吏?섏감?????몃? ?곌껐留?,
    };
  }
  if (location.category === "COMMAND_VEHICLE") {
    return {
      scope: "?꾩옣留?吏묒꽑쨌?몃?留??곌껐",
      role: "吏?샕룻넻?좎감??,
      carries: "LPWA쨌?댁쓬5G쨌TVWS쨌LTE쨌?꾩꽦 ?듯빀 ?몃옒??,
      path: "?꾩옣 ??띉룰퀬?띾쭩 ??吏?섏감?????몃?留씲룻겢?쇱슦??,
    };
  }
  return null;
}

function overviewLatestUpdateTime(overview: EventOverview) {
  const timestampKeys = new Set([
    "updatedAt", "createdAt", "occurredAt", "observedAt", "receivedAt",
    "reportedAt", "issuedAt", "startedAt", "analyzedAt", "assessedAt",
    "baseTime", "detectedAt", "firstDetectedAt", "lastDetectedAt",
  ]);
  let latest = 0;
  const visit = (value: unknown) => {
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    if (!value || typeof value !== "object") return;
    for (const [key, nested] of Object.entries(value)) {
      if (timestampKeys.has(key) && typeof nested === "string") {
        const parsed = Date.parse(nested);
        if (Number.isFinite(parsed)) latest = Math.max(latest, parsed);
      } else {
        visit(nested);
      }
    }
  };
  visit({
    event: overview.event,
    assets: overview.assets,
    unregisteredAssets: overview.unregisteredAssets,
    personnel: overview.personnel,
    networks: overview.networks,
    topology: overview.topology,
    alerts: overview.alerts,
    reports: overview.reports,
    kpis: overview.kpis,
    domainDetail: overview.domainDetail,
    domainLayers: overview.domainLayers,
  });
  return latest;
}

function overviewLocations(overview: EventOverview): LiveLocation[] {
  return [
    ...overview.personnel.map((item) => locationFrom(item, "personnel")),
    ...overview.assets.map((item) => locationFrom(item, "asset")),
    ...overview.unregisteredAssets.map((item) => locationFrom(item, "asset")),
  ].filter((item): item is LiveLocation => item !== null);
}


function demoRtkAssetsFromTelemetry(
  rows: ApiRecord[],
): ApiRecord[] {
  const latest = new Map<string, ApiRecord>();

  for (const row of rows) {
    if (String(row.assetType ?? "") !== "RTK_TERMINAL") {
      continue;
    }

    const assetId = String(
      row.assetId ??
      row.sourceAssetId ??
      "",
    ).trim();

    const latitude = Number(row.latitude);
    const longitude = Number(row.longitude);
    const altitude = Number(row.altitude);
    const observedAt = String(row.observedAt ?? "");

    if (
      !assetId ||
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude) ||
      latitude < -90 ||
      latitude > 90 ||
      longitude < -180 ||
      longitude > 180 ||
      (latitude === 0 && longitude === 0) ||
      !observedAt ||
      !Number.isFinite(Date.parse(observedAt))
    ) {
      continue;
    }

    const attributes =
      row.attributes &&
      typeof row.attributes === "object" &&
      !Array.isArray(row.attributes)
        ? row.attributes as ApiRecord
        : {};

    const linkQuality =
      attributes.linkQuality &&
      typeof attributes.linkQuality === "object" &&
      !Array.isArray(attributes.linkQuality)
        ? attributes.linkQuality as ApiRecord
        : {};

    const rssi = Number(linkQuality.rssiDbm);

    latest.set(assetId, {
      assetId,

      assetCode:
        String(row.assetCode ?? assetId),

      assetName:
        String(
          row.assetName ??
          `Sleno RTK ?⑤쭚 ${assetId.slice(0, 8)}`
        ),

      assetType:
        "RTK_TERMINAL",

      operationalStatus:
        String(
          row.operationalStatus ??
          "UNKNOWN"
        ),

      observedAt,

      receivedAt:
        String(
          row.receivedAt ??
          observedAt
        ),

      geometry: {
        type: "Point",
        coordinates: [
          longitude,
          latitude,
          Number.isFinite(altitude)
            ? altitude
            : 0,
        ],
      },

      signalStrengthDbm:
        Number.isFinite(rssi)
          ? rssi
          : null,

      packetLossPct:
        row.packetLossPct ?? null,

      positioningMethod:
        String(
          row.positioningMethod ??
          attributes.fixType ??
          "GNSS"
        ),

      qualityStatus:
        String(
          row.operationalStatus ??
          ""
        ),

      sourceSystem:
        String(
          attributes.sourceSystem ??
          "sleno-server"
        ),

      sourceAssetId:
        String(
          row.sourceAssetId ??
          assetId
        ),

      reportedByAssetId: "",
      reportingRole: "JININFRA",

      activeLink:
        String(
          attributes.networkType ??
          "LORAWAN"
        ),

      eventRegistrationStatus:
        "REGISTERED",

      attributes,
    });
  }

  return [...latest.values()];
}

const fallbackTopologyLabels: Record<string, string[]> = {
  ENDPOINT: ["???RTK ?⑤쭚", "?쒕줎쨌?곸긽?λ퉬", "400??臾댁쟾湲?],
  FIELD: ["LPWA 쨌 ???, "?댁쓬5G 쨌 怨좎냽", "臾댁쟾 以묎퀎留?],
  COMMAND: ["寃뚯씠?몄썾?는텹3 ?ㅼ쐞移?, "RTK 湲곗?援?, "?꾩옣 ?곹솴??],
  BACKHAUL: ["LTE", "TVWS", "LEO ?꾩꽦"],
  CLOUD: ["?섏쭛 API", "PostgreSQL", "?듯빀 ?곹솴??],
};

function topologyLabelsFor(overview: EventOverview | null, layer: string) {
  const labels = overview?.topology.nodes
    .filter((node) => String(node.topologyLayer) === layer && String(node.status) !== "UNAVAILABLE")
    .sort((left, right) => Number(left.sortOrder ?? 0) - Number(right.sortOrder ?? 0))
    .map((node) => String(node.nodeName ?? node.nodeCode ?? ""))
    .filter(Boolean) ?? [];
  return labels.length ? labels : fallbackTopologyLabels[layer] ?? [];
}

function buildTimelineSnapshots(timeline: EventTimeline | null, currentAssets: ApiRecord[]): MapTimelineSnapshot[] {
  if (!timeline) return [];
  const fromMs = Math.floor(Date.parse(timeline.from) / 60_000) * 60_000;
  const toMs = Math.floor(Date.parse(timeline.to) / 60_000) * 60_000;
  if (!Number.isFinite(fromMs) || !Number.isFinite(toMs) || fromMs > toMs) return [];

  const assetCatalog = new Map(currentAssets.map((asset) => [String(asset.assetId), asset]));
  const assetRows = [...timeline.assetStatuses].sort((left, right) => Date.parse(String(left.observedAt)) - Date.parse(String(right.observedAt)));
  const personnelRows = [...timeline.personnelPositions].sort((left, right) => Date.parse(String(left.observedAt)) - Date.parse(String(right.observedAt)));
  const latestAssets = new Map<string, ApiRecord>();
  const latestPersonnel = new Map<string, ApiRecord>();
  let assetIndex = 0;
  let personnelIndex = 0;
  const snapshots: MapTimelineSnapshot[] = [];

  for (let at = fromMs; at <= toMs; at += 60_000) {
    while (assetIndex < assetRows.length && Date.parse(String(assetRows[assetIndex]?.observedAt)) <= at + 59_999) {
      const row = assetRows[assetIndex++]!;
      latestAssets.set(String(row.assetId), row);
    }
    while (personnelIndex < personnelRows.length && Date.parse(String(personnelRows[personnelIndex]?.observedAt)) <= at + 59_999) {
      const row = personnelRows[personnelIndex++]!;
      latestPersonnel.set(String(row.personExternalId), row);
    }
    const locations = [
      ...[...latestPersonnel.values()].map((row) => locationFrom(row, "personnel")),
      ...[...latestAssets.values()].map((row) => locationFrom({ ...assetCatalog.get(String(row.assetId)), ...row }, "asset")),
    ].filter((location): location is LiveLocation => location !== null);
    snapshots.push({ at: new Date(at).toISOString(), locations });
  }
  return snapshots;
}

function webMercatorToLngLat(x: number, y: number): [number, number] | null {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;

  const originShift = 20037508.342789244;

  if (
    Math.abs(x) > originShift * 1.05 ||
    Math.abs(y) > originShift * 1.05
  ) {
    return null;
  }

  const longitude = (x / originShift) * 180;
  const latitude =
    (Math.atan(Math.exp((y / originShift) * Math.PI)) * 360) / Math.PI -
    90;

  if (
    !Number.isFinite(longitude) ||
    !Number.isFinite(latitude) ||
    longitude < -180 ||
    longitude > 180 ||
    latitude < -90 ||
    latitude > 90
  ) {
    return null;
  }

  return [longitude, latitude];
}

const districtCenters: Record<string, [number, number]> = {
  "?됱갹": [128.390, 37.370], "?됱갹援?: [128.390, 37.370], "媛뺣쫱": [128.876, 37.752], "媛뺣쫱??: [128.876, 37.752],
  "?띿쿇": [127.888, 37.697], "?띿쿇援?: [127.888, 37.697], "?뺤꽑": [128.661, 37.380], "?뺤꽑援?: [128.661, 37.380],
  "?먯＜": [127.920, 37.342], "?먯＜??: [127.920, 37.342], "異섏쿇": [127.730, 37.881], "異섏쿇??: [127.730, 37.881],
  "?몄젣": [128.170, 38.070], "?몄젣援?: [128.170, 38.070], "?묒뼇": [128.619, 38.075], "?묒뼇援?: [128.619, 38.075],
  "?몄쭊": [129.400, 36.993], "?몄쭊援?: [129.400, 36.993], "遊됲솕": [128.733, 36.893], "遊됲솕援?: [128.733, 36.893],
  "諛??: [128.746, 35.503], "諛?묒떆": [128.746, 35.503], "?⑹쿇": [128.166, 35.566], "?⑹쿇援?: [128.166, 35.566],
};
function pointBuffer([longitude, latitude]: [number, number], radius: number) {
  const ring = Array.from({ length: 25 }, (_, index) => {
    const angle = (index / 24) * Math.PI * 2;
    return [longitude + Math.cos(angle) * radius, latitude + Math.sin(angle) * radius] as [number, number];
  });
  return { type: "Polygon", coordinates: [ring] };
}
function districtCenter(...names: unknown[]): [number, number] | null {
  for (const value of names) {
    const raw = String(value ?? "").trim();
    const direct = districtCenters[raw];
    if (direct) return direct;
    const match = Object.entries(districtCenters).find(([name]) => raw.includes(name));
    if (match) return match[1];
  }
  return null;
}

export default function UnifiedDisasterDashboard() {
  const displayProfile = parseDisplayProfile(window.location.search);
  const displayConfig = getDisplayProfileConfig(displayProfile);
  const displayClassName = displayProfileClassName(displayProfile);
  const demoScenario = demoScenarioFromLocation();
  const [events, setEvents] = useState<ForestEvent[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [overview, setOverview] = useState<EventOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [eventsLoaded, setEventsLoaded] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const demoMode = FORCE_DEMO_MODE;
  const localE2EMode = FORCE_LOCAL_E2E_MODE;
  const localFieldMode = FORCE_LOCAL_FIELD_MODE;
  const fieldPreviewMode = FORCE_FIELD_PREVIEW_MODE;
  const commandShellMode = true;
  const [requirementsOpen, setRequirementsOpen] = useState(false);
  const [telemetryStreamStatus, setTelemetryStreamStatus] = useState<TelemetryStreamStatus>("DISABLED");
  const [telemetrySamples, setTelemetrySamples] = useState<TelemetrySample[]>([]);
  const demoSequenceRef = useRef(0);
  const previousLocationsRef = useRef<Map<string, string> | null>(null);
  const previousOverviewUpdateTimeRef = useRef<number | null>(null);
  const highlightDurationRef = useRef(DEFAULT_CHANGE_HIGHLIGHT_MS);
  const [changedUntil, setChangedUntil] = useState<Record<string, number>>({});
  const [highlightDurationMs, setHighlightDurationMs] = useState(DEFAULT_CHANGE_HIGHLIGHT_MS);
  const [visibleResourceGroups, setVisibleResourceGroups] = useState<Set<ResourceGroup>>(
    () => new Set(["PERSONNEL", "UAV", "COMMAND", "POSITIONING", "COMMUNICATION", "DETECTION", "UNASSIGNED"]),
  );
  const [operationsTab, setOperationsTab] = useState<PanelTab>(
    SHOW_VALIDATION_UI ? "kpis" : "networks",
  );
  const [selectedLocationKey, setSelectedLocationKey] = useState<string | null>(null);
  const [topologyLocationKey, setTopologyLocationKey] = useState<string | null>(null);
  const [resourceDialogGroup, setResourceDialogGroup] = useState<ResourceGroup | "ALL" | "ALL_ASSETS" | null>(null);

  const [videoDrone, setVideoDrone] = useState<LiveLocation | null>(null);
  const [fieldInspectorTab, setFieldInspectorTab] =
    useState<"quality" | "details" | "video">("quality");

  // Field command video channels.
  // RTSP itself is not browser-playable; this state reflects the real
  // channel configuration registered for the primary UAV.
  const [fieldVideoChannels, setFieldVideoChannels] = useState<ApiRecord[]>([]);
  const [fieldVideoLoading, setFieldVideoLoading] = useState(false);
  const [fieldVideoPlaybackStates, setFieldVideoPlaybackStates] =
    useState<Record<string, VideoPlaybackState>>({});
  const [timeline, setTimeline] = useState<EventTimeline | null>(null);
  const [timelineIndex, setTimelineIndex] = useState<number | null>(null);
  const [timelinePlaying, setTimelinePlaying] = useState(false);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [visibleLayerIds, setVisibleLayerIds] = useState(() => new Set([
    "resources",
    "topology",
    "event",
    "communication-coverages",
  ]));
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);

  const [externalFirmsRows, setExternalFirmsRows] = useState<ApiRecord[]>([]);
  const [externalLandslideHistoryRows, setExternalLandslideHistoryRows] =
    useState<ApiRecord[]>([]);
  const [externalWildfireRiskRows, setExternalWildfireRiskRows] = useState<ApiRecord[]>([]);
  const [externalLandslideForecastRows, setExternalLandslideForecastRows] = useState<ApiRecord[]>([]);
  const [externalLandslideRegionalRows, setExternalLandslideRegionalRows] = useState<ApiRecord[]>([]);

  const [externalIntegrationStatus, setExternalIntegrationStatus] =
    useState<ExternalIntegrationStatus>({
      firms: { status: "idle", count: 0, checkedAt: null },
      wildfireRisk: { status: "idle", count: 0, checkedAt: null },
      landslideForecast: { status: "idle", count: 0, checkedAt: null },
      landslideHistory: { status: "idle", count: 0, checkedAt: null },
      landslideRegionalRisk: { status: "idle", count: 0, checkedAt: null },
    });

  const refreshEvents = useCallback(async () => {
    if (localFieldMode) {
      const event = fieldEvent();
      setEvents([event]);
      setSelectedId(event.eventId);
      setError(null);
      return;
    }
    if (localE2EMode) {
      setEvents([LOCAL_E2E_EVENT]);
      setSelectedId(LOCAL_E2E_EVENT.eventId);
      setError(null);
      return;
    }
    const result = await loadDashboardDisasterAssetsCached(DEFAULT_EVENT_ID);
    const disaster = result.data.disaster;
    const rawDisasterType = String(disaster.disasterType ?? "WILDFIRE").toUpperCase();
    const disasterType: ForestEvent["disasterType"] =
      rawDisasterType === "LANDSLIDE" || rawDisasterType === "COMPLEX"
        ? rawDisasterType
        : "WILDFIRE";

    const currentEvent: ForestEvent = {
      eventId: disaster.disasterId || DEFAULT_EVENT_ID,
      eventCode: disaster.disasterCode,
      disasterType,
      eventName: disaster.disasterName,
      status: disaster.status,
    };

    setEvents([currentEvent]);
    setSelectedId((current) => current || currentEvent.eventId);
    setError(null);
  }, [localE2EMode, localFieldMode]);

  /* FIELD_EXTERNAL_API_FINAL */
  const refreshExternalIntegrations = useCallback(async () => {
    /* FIELD_EXTERNAL_INTEGRATIONS_ENABLED */
    if (localE2EMode) {
      setExternalFirmsRows([]);
      setExternalLandslideHistoryRows([]);
      setExternalWildfireRiskRows([]);
      setExternalLandslideForecastRows([]);
      setExternalLandslideRegionalRows([]);
      setExternalIntegrationStatus({
        firms: { status: "idle", count: 0, checkedAt: null },
        wildfireRisk: { status: "idle", count: 0, checkedAt: null },
        landslideForecast: { status: "idle", count: 0, checkedAt: null },
        landslideHistory: { status: "idle", count: 0, checkedAt: null },
        landslideRegionalRisk: { status: "idle", count: 0, checkedAt: null },
      });
      return;
    }
    if (demoMode) {
      const demo = createDemoOverview();
      const checkedAt = new Date().toISOString();
      setExternalFirmsRows(demo.domainLayers["external-firms"] ?? []);
      setExternalLandslideHistoryRows(demo.domainLayers["external-landslide-history"] ?? []);
      setExternalWildfireRiskRows(demo.domainLayers["wildfire-risk-zones"] ?? []);
      setExternalLandslideForecastRows(demo.domainLayers["slope-assessments"] ?? []);
      setExternalLandslideRegionalRows(demo.domainLayers["slope-gradients"] ?? []);
      setExternalIntegrationStatus({
        firms: { status: "ok", count: 1, checkedAt }, wildfireRisk: { status: "ok", count: 1, checkedAt },
        landslideForecast: { status: "ok", count: 1, checkedAt }, landslideHistory: { status: "ok", count: 1, checkedAt },
        landslideRegionalRisk: { status: "ok", count: 1, checkedAt },
      });
      return;
    }
    setExternalIntegrationStatus((current) => ({
      firms: { ...current.firms, status: "loading", message: undefined },
      wildfireRisk: { ...current.wildfireRisk, status: "loading", message: undefined },
      landslideForecast: { ...current.landslideForecast, status: "loading", message: undefined },
      landslideHistory: { ...current.landslideHistory, status: "loading", message: undefined },
      landslideRegionalRisk: {
        ...current.landslideRegionalRisk,
        status: "loading",
        message: undefined,
      },
    }));

    const [
      firms,
      wildfireRisk,
      landslideForecast,
      landslideHistory,
      landslideRegionalRisk,
    ] = await Promise.allSettled([
      externalDisasterApi.wildfireFirms(),
      externalDisasterApi.wildfireRisk(1, 100),
      externalDisasterApi.landslideForecast(1, 100),
      externalDisasterApi.landslideHistory(1, 100),
      externalDisasterApi.landslideRegionalRisk(1, 100),
    ]);

    const checkedAt = new Date().toISOString();

    const errorMessage = (reason: unknown) =>
      reason instanceof Error ? reason.message : "?몃? API ?붿껌 ?ㅽ뙣";

    if (firms.status === "fulfilled") {
      setExternalFirmsRows(
        firms.value.data.flatMap((item, index) => {
          const longitude = Number(item.longitude);
          const latitude = Number(item.latitude);

          if (
            !Number.isFinite(longitude) ||
            !Number.isFinite(latitude) ||
            longitude < -180 ||
            longitude > 180 ||
            latitude < -90 ||
            latitude > 90
          ) {
            return [];
          }

          return [{
            id: `firms-${index}-${item.acquiredAt ?? "unknown"}`,
            observedAt: item.acquiredAt ?? checkedAt,
            provider: "NASA FIRMS",
            confidence: item.confidence,
            frp: item.frp,
            resultGeometry: {
              type: "Point",
              coordinates: [longitude, latitude],
            },
          } as ApiRecord];
        }),
      );
    }

    if (landslideHistory.status === "fulfilled") {
      setExternalLandslideHistoryRows(
        landslideHistory.value.data.flatMap((item) => {
          const position = webMercatorToLngLat(
            Number(item.x),
            Number(item.y),
          );

          if (!position) return [];

          return [{
            id: `landslide-history-${item.serialNumber}`,
            observedAt: item.occurredDate,
            provider: "?щ궃?덉쟾?곗씠??,
            disasterName: item.disasterName,
            address: item.address,
            resultGeometry: {
              type: "Point",
              coordinates: position,
            },
          } as ApiRecord];
        }),
      );
    }

    if (wildfireRisk.status === "fulfilled") setExternalWildfireRiskRows(wildfireRisk.value.data.flatMap((item, index) => {
      const coordinates = districtCenter(item.district, item.area, item.province);
      return coordinates ? [{ id: `kfs-risk-${item.regionCode || index}`, observedAt: item.analyzedAt || checkedAt, provider: "?곕┝泥?, riskScore: item.mean ?? item.max, district: item.district, resultGeometry: pointBuffer(coordinates, 0.035) }] : [];
    }));
    if (landslideForecast.status === "fulfilled") setExternalLandslideForecastRows(landslideForecast.value.data.flatMap((item, index) => {
      const coordinates = districtCenter(item.district);
      return coordinates ? [{ id: `slide-forecast-${index}`, observedAt: item.predictedAt || checkedAt, provider: "?щ궃?덉쟾?곗씠??, forecast: item.forecast, resultGeometry: pointBuffer(coordinates, 0.028) }] : [];
    }));
    if (landslideRegionalRisk.status === "fulfilled") setExternalLandslideRegionalRows(landslideRegionalRisk.value.data.flatMap((item, index) => {
      const coordinates = districtCenter(item.districtName, item.detailAddress);
      return coordinates ? [{ id: `slide-regional-${item.managementNumber || index}`, observedAt: item.lastModifiedAt || checkedAt, provider: "?щ궃?덉쟾?곗씠??, riskGrade: item.riskGradeCode, expectedPeople: item.expectedPeople, resultGeometry: pointBuffer(coordinates, 0.022) }] : [];
    }));

    setExternalIntegrationStatus((current) => ({
      firms: firms.status === "fulfilled"
        ? {
            status: "ok",
            count: firms.value.meta.count,
            checkedAt,
            lastSuccessAt: checkedAt,
          }
        : {
            status: "error",
            count: current.firms.count,
            checkedAt,
            lastSuccessAt: current.firms.lastSuccessAt,
            servingStale: current.firms.count > 0,
            message: errorMessage(firms.reason),
          },

      wildfireRisk: wildfireRisk.status === "fulfilled"
        ? {
            status: "ok",
            count: wildfireRisk.value.meta.count,
            checkedAt,
            lastSuccessAt: checkedAt,
          }
        : {
            status: "error",
            count: current.wildfireRisk.count,
            checkedAt,
            lastSuccessAt: current.wildfireRisk.lastSuccessAt,
            servingStale: current.wildfireRisk.count > 0,
            message: errorMessage(wildfireRisk.reason),
          },

      landslideForecast: landslideForecast.status === "fulfilled"
        ? {
            status: "ok",
            count: landslideForecast.value.meta.count,
            checkedAt,
            lastSuccessAt: checkedAt,
          }
        : {
            status: "error",
            count: current.landslideForecast.count,
            checkedAt,
            lastSuccessAt: current.landslideForecast.lastSuccessAt,
            servingStale: current.landslideForecast.count > 0,
            message: errorMessage(landslideForecast.reason),
          },

      landslideHistory: landslideHistory.status === "fulfilled"
        ? {
            status: "ok",
            count: landslideHistory.value.meta.count,
            checkedAt,
            lastSuccessAt: checkedAt,
          }
        : {
            status: "error",
            count: current.landslideHistory.count,
            checkedAt,
            lastSuccessAt: current.landslideHistory.lastSuccessAt,
            servingStale: current.landslideHistory.count > 0,
            message: errorMessage(landslideHistory.reason),
          },

      landslideRegionalRisk: landslideRegionalRisk.status === "fulfilled"
        ? {
            status: "ok",
            count: landslideRegionalRisk.value.meta.count,
            checkedAt,
            lastSuccessAt: checkedAt,
          }
        : {
            status: "error",
            count: current.landslideRegionalRisk.count,
            checkedAt,
            lastSuccessAt: current.landslideRegionalRisk.lastSuccessAt,
            servingStale: current.landslideRegionalRisk.count > 0,
            message: errorMessage(landslideRegionalRisk.reason),
          },
    }));
  }, [demoMode, localE2EMode]);

  useEffect(() => {
    void refreshExternalIntegrations();

    const timer = window.setInterval(() => {
      void refreshExternalIntegrations();
    }, 30_000);

    return () => window.clearInterval(timer);
  }, [refreshExternalIntegrations]);

  const refreshOverview = useCallback(async () => {
    const selected = events.find((event) => event.eventId === selectedId);
    if (!selected) return;

    const result = fieldPreviewMode
      ? {
          ...createDemoOverview(),
          event: selected,
        }
      : await loadEventOverview(selected);
    const polledTelemetrySamples = result.assets
      .map((asset) => telemetrySampleFromLiveAsset(asset))
      .filter((sample): sample is TelemetrySample => sample !== null);
    if (polledTelemetrySamples.length > 0) {
      setTelemetrySamples((current) => {
        const next = [...current];
        const seen = new Set(current.map((sample) => `${sample.assetId}|${sample.observedAt}|${sample.sequence ?? ""}`));
        for (const sample of polledTelemetrySamples) {
          const key = `${sample.assetId}|${sample.observedAt}|${sample.sequence ?? ""}`;
          if (seen.has(key)) continue;
          seen.add(key);
          next.push(sample);
        }
        return next.slice(-3_600);
      });
    }
    const locations = overviewLocations(result);
    const current = new Map(locations.map((item) => [locationKey(item), locationFingerprint(item)]));
    const previous = previousLocationsRef.current;
    const currentOverviewUpdateTime = overviewLatestUpdateTime(result);
    const overviewChanged =
      previousOverviewUpdateTimeRef.current !== null &&
      currentOverviewUpdateTime > previousOverviewUpdateTimeRef.current;
    if (previous) {
      const now = Date.now();
      const updateIntervalMs = previousOverviewUpdateTimeRef.current === null
        ? POLL_INTERVAL_MS
        : currentOverviewUpdateTime - previousOverviewUpdateTimeRef.current;
      const changeDurationMs = overviewChanged
        ? Math.max(300, Math.min(3_000, updateIntervalMs * 0.3))
        : highlightDurationRef.current;
      if (overviewChanged) {
        highlightDurationRef.current = changeDurationMs;
        setHighlightDurationMs(changeDurationMs);
      }
      const changedKeys = overviewChanged
        ? [...current.keys()]
        : [...current].filter(([key, fingerprint]) => previous.get(key) !== fingerprint).map(([key]) => key);
      setChangedUntil((existing) => {
        const next = Object.fromEntries(Object.entries(existing).filter(([, until]) => until > now));
        for (const key of changedKeys) next[key] = now + changeDurationMs;
        return next;
      });
      if (changedKeys.length) {
        window.setTimeout(() => {
          const expiredAt = Date.now();
          setChangedUntil((existing) => Object.fromEntries(Object.entries(existing).filter(([, until]) => until > expiredAt)));
        }, changeDurationMs + 25);
      }
    }
    previousLocationsRef.current = current;
    previousOverviewUpdateTimeRef.current = Math.max(
      previousOverviewUpdateTimeRef.current ?? 0,
      currentOverviewUpdateTime,
    );
    setOverview(result);
    setLastUpdatedAt(new Date());
  }, [events, fieldPreviewMode, selectedId]);

  useEffect(() => {
    previousLocationsRef.current = null;
    previousOverviewUpdateTimeRef.current = null;
    setChangedUntil({});
    setSelectedLocationKey(null);
    setTopologyLocationKey(null);
    setTimeline(null);
    setTimelineIndex(null);
    setTimelinePlaying(false);
    setTelemetrySamples([]);
    demoSequenceRef.current = 0;
  }, [selectedId]);

  useEffect(() => {
    if (!selectedLocationKey && !resourceDialogGroup && !topologyLocationKey && !videoDrone) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSelectedLocationKey(null);
        setResourceDialogGroup(null);
        setTopologyLocationKey(null);

        setVideoDrone(null);
      }
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [resourceDialogGroup, selectedLocationKey, topologyLocationKey, videoDrone]);

  useEffect(() => {
    let active = true;
    if (FORCE_DEMO_MODE) {
      const demo = createDemoOverview();
      setEvents([demo.event]);
      setSelectedId(demo.event.eventId);
      setOverview(demo);
      setLastUpdatedAt(new Date());
      setEventsLoaded(true);
      return () => { active = false; };
    }
    refreshEvents()
      .catch((caught: unknown) => {
        if (!active) return;
        setError(caught instanceof Error ? caught.message : "?? ?? ?? ??");
      })
      .finally(() => active && setEventsLoaded(true));
    return () => { active = false; };
  }, [refreshEvents]);

  useEffect(() => {
    if (demoMode || localE2EMode || localFieldMode) return;
    const timer = window.setInterval(() => {
      refreshEvents().catch(() => undefined);
    }, 10_000);
    return () => window.clearInterval(timer);
  }, [demoMode, localE2EMode, localFieldMode, refreshEvents]);

  useEffect(() => {
    if (!selectedId) return;
    let active = true;
    const refresh = () => demoMode
      ? (async () => {
          const next = createDemoOverview();

          /*
           * ?댁쁺 WILDFIRE demo ?붾㈃? ?좎??섎릺
           * ?ㅼ젣 Core???ㅼ뼱??Sleno RTK ?꾩튂留?
           * live overlay ?쒕떎.
           */
          try {
            const response =
              await forestApi
                .dashboardDroneTelemetry(
                  selectedId
                );

            const slenoAssets =
              demoRtkAssetsFromTelemetry(
                response.data
              );

            if (slenoAssets.length > 0) {
              const liveAssetIds =
                new Set(
                  slenoAssets.map(
                    (asset) =>
                      String(
                        asset.assetId
                      )
                  )
                );

              next.assets = [
                ...next.assets.filter(
                  (asset) =>
                    !liveAssetIds.has(
                      String(
                        asset.assetId
                      )
                    )
                ),
                ...slenoAssets,
              ];
            }
          } catch (caught) {
            console.warn(
              "[demo] Sleno RTK live overlay unavailable",
              caught
            );
          }

          setOverview(next);
          const sequence = ++demoSequenceRef.current;
          setTelemetrySamples((current) => [...current, ...next.assets
            .filter((asset) => !(String(asset.assetId) === "DRONE-01" && sequence % 20 === 0))
            .map((asset) => {
            const coordinates = (asset.geometry as { coordinates?: unknown[] } | undefined)?.coordinates;
            return {
              assetId: String(asset.assetId),
              entityType: "ASSET",
              assetType: String(asset.assetType ?? "ASSET"),
              observedAt: String(asset.observedAt),
              receivedAt: new Date().toISOString(),
              sequence,
              latitude: Number(coordinates?.[1]),
              longitude: Number(coordinates?.[0]),
            } satisfies TelemetrySample;
          })].slice(-3_600));
          setLastUpdatedAt(new Date());
          return;
        })()
      : refreshOverview()
      .then(() => active && setError(null))
      .catch((caught: unknown) => active && setError(caught instanceof Error ? caught.message : "?꾪솴 議고쉶 ?ㅽ뙣"));
    void refresh();
    const timer = window.setInterval(refresh, POLL_INTERVAL_MS);
    return () => { active = false; window.clearInterval(timer); };
  }, [demoMode, refreshOverview, selectedId]);

  useEffect(() => {
    const url = import.meta.env.VITE_TELEMETRY_WS_URL?.trim();
    if (demoMode || localE2EMode || localFieldMode || !url || !selectedId) {
      setTelemetryStreamStatus("DISABLED");
      return;
    }
    const client = new TelemetryStreamClient({
      url,
      eventId: selectedId,
      onStatus: setTelemetryStreamStatus,
      onMessage: (message) => {
        setOverview((current) => current ? applyTelemetrySafetyRules(current, message) : current);
        setTelemetrySamples((current) => [...current, {
          assetId: message.assetId,
          entityType: message.entityType,
          assetType: message.assetType,
          observedAt: message.observedAt,
          receivedAt: message.receivedAt ?? new Date().toISOString(),
          sequence: message.sequence,
          latitude: message.latitude,
          longitude: message.longitude,
        }].slice(-3_600));
        setLastUpdatedAt(new Date());
      },
    });
    client.connect();
    return () => client.stop();
  }, [demoMode, localE2EMode, localFieldMode, selectedId]);

  useEffect(() => {
    if (!selectedId || localE2EMode || localFieldMode) {
      if (localE2EMode || localFieldMode) setTimeline(null);
      return;
    }
    let active = true;
    const refreshTimeline = async () => {
      if (active) setTimelineLoading(true);
      const to = new Date();
      const from = new Date(to.getTime() - 60 * 60_000);
      try {
        const result = await loadEventTimeline(selectedId, from.toISOString(), to.toISOString());
        if (active) setTimeline(result);
      } catch {
        if (active) setTimeline(null);
      } finally {
        if (active) setTimelineLoading(false);
      }
    };
    void refreshTimeline();
    const timer = window.setInterval(refreshTimeline, 60_000);
    return () => { active = false; window.clearInterval(timer); };
  }, [localE2EMode, localFieldMode, selectedId]);

  const mapDomainLayers = useMemo<Record<string, ApiRecord[]>>(
    () => ({
      ...overview?.domainLayers,
      "external-firms": externalFirmsRows,
      "external-landslide-history": externalLandslideHistoryRows,
      "external-wildfire-risk": externalWildfireRiskRows,
      "external-landslide-forecast": externalLandslideForecastRows,
      "external-landslide-regional-risk": externalLandslideRegionalRows,
    }),
    [
      overview?.domainLayers,
      externalFirmsRows,
      externalLandslideHistoryRows,
      externalWildfireRiskRows,
      externalLandslideForecastRows,
      externalLandslideRegionalRows,
    ],
  );

  const liveLocations = useMemo(() => overview ? overviewLocations(overview) : [], [overview]);

  /* FIELD_DEOKSUNG_SCENARIO_ALIGNMENT */
  const FIELD_DEOKSUNG_CENTER: [number, number] = [126.616667, 36.666667];

  /*
   * Preview only:
   * Preserve the relative layout of all synthetic assets,
   * but translate the whole scenario to Deoksungsan.
   *
   * REAL ?field=1 locations are NEVER modified here.
   */
  const fieldScenarioLocations = useMemo(() => {
    if (!fieldPreviewMode || liveLocations.length === 0) {
      return liveLocations;
    }

    const anchor =
      liveLocations.find((location) => resourceGroupOf(location) === "UAV")
      ?? liveLocations[0];

    const deltaLongitude = FIELD_DEOKSUNG_CENTER[0] - anchor.longitude;
    const deltaLatitude = FIELD_DEOKSUNG_CENTER[1] - anchor.latitude;

    return liveLocations.map((location) => ({
      ...location,
      longitude: location.longitude + deltaLongitude,
      latitude: location.latitude + deltaLatitude,
    }));
  }, [fieldPreviewMode, liveLocations]);

  const timelineSnapshots = useMemo(
    () => buildTimelineSnapshots(timeline, [...(overview?.assets ?? []), ...(overview?.unregisteredAssets ?? [])]),
    [overview?.assets, overview?.unregisteredAssets, timeline],
  );
  useEffect(() => {
    if (!timelinePlaying || timelineSnapshots.length < 2) return;
    const current = timelineIndex ?? 0;
    if (current >= timelineSnapshots.length - 1) {
      setTimelinePlaying(false);
      return;
    }
    const timer = window.setTimeout(() => setTimelineIndex(current + 1), 1_000);
    return () => window.clearTimeout(timer);
  }, [timelineIndex, timelinePlaying, timelineSnapshots.length]);
  const playbackSnapshot = timelineIndex == null ? null : timelineSnapshots[timelineIndex] ?? null;
  const mapLocations =
    playbackSnapshot?.locations
    ?? (fieldPreviewMode ? fieldScenarioLocations : liveLocations);
  const handleTimelinePlayToggle = useCallback(() => {
    if (timelineSnapshots.length < 2) return;
    if (timelinePlaying) {
      setTimelinePlaying(false);
      return;
    }
    setTimelineIndex((current) => current == null || current >= timelineSnapshots.length - 1 ? 0 : current);
    setTimelinePlaying(true);
  }, [timelinePlaying, timelineSnapshots.length]);
  const handleTimelineIndexChange = useCallback((index: number) => {
    setTimelinePlaying(false);
    setTimelineIndex(index);
    setSelectedLocationKey(null);
  }, []);
  const handleTimelineLive = useCallback(() => {
    setTimelinePlaying(false);
    setTimelineIndex(null);
    setSelectedLocationKey(null);
  }, []);
  const activeAlertCount = useMemo(() => overview?.alerts.filter((item) => !["RESOLVED", "EXPIRED", "CANCELLED"].includes(String(item.status))).length ?? 0, [overview]);
  /* PHASE_5_3B_PREVIEW_MOTION */
  const [fieldPreviewMotionTick, setFieldPreviewMotionTick] = useState(0);

  useEffect(() => {
    if (!fieldPreviewMode) {
      setFieldPreviewMotionTick(0);
      return;
    }

    const timer = window.setInterval(() => {
      setFieldPreviewMotionTick((current) => current + 1);
    }, 1_000);

    return () => window.clearInterval(timer);
  }, [fieldPreviewMode]);

  const visibleLocations = useMemo(() => {
    return mapLocations
      .filter((item) => visibleResourceGroups.has(resourceGroupOf(item)))
      .map((item) => {
        if (fieldPreviewMode && resourceGroupOf(item) === "UAV") {
          const phase = fieldPreviewMotionTick * 0.34;

          const latitude =
            item.latitude +
            Math.sin(phase) * 0.0018 +
            fieldPreviewMotionTick * 0.00008;

          const longitude =
            item.longitude +
            Math.cos(phase) * 0.0022 +
            fieldPreviewMotionTick * 0.00010;

          return {
            ...item,
            latitude,
            longitude,
            headingDeg: (231 + fieldPreviewMotionTick * 11) % 360,
          };
        }

        return item;
      });
  }, [
    fieldPreviewMode,
    fieldPreviewMotionTick,
    mapLocations,
    visibleResourceGroups,
  ]);
  const eventCoordinates = overview?.event.geometry?.coordinates;
  const eventCenter: [number, number] | null =
    localFieldMode
      ? FIELD_DEOKSUNG_CENTER
      : eventCoordinates
        && Number.isFinite(Number(eventCoordinates[0]))
        && Number.isFinite(Number(eventCoordinates[1]))
          ? [Number(eventCoordinates[0]), Number(eventCoordinates[1])] as [number, number]
          : null;
  const liveCenter = mapLocations.length
    ? (() => {
        const middle = Math.floor(mapLocations.length / 2);
        const median = (values: number[]) => {
          const sorted = [...values].sort((a, b) => a - b);
          return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
        };
        return [
          median(mapLocations.map((item) => item.longitude)),
          median(mapLocations.map((item) => item.latitude)),
        ] as [number, number];
      })()
    : null;
  const eventToLiveDistance = eventCenter && liveCenter
    ? Math.hypot(eventCenter[0] - liveCenter[0], eventCenter[1] - liveCenter[1])
    : 0;
  const eventToLiveDistanceKm = eventCenter && liveCenter
    ? Math.hypot(
        (eventCenter[0] - liveCenter[0]) * 88.8,
        (eventCenter[1] - liveCenter[1]) * 111,
      )
    : 0;
  /*
   * WILDFIRE demo?먯꽌 ?ㅼ젣 Sleno RTK媛 ?ㅼ뼱?ㅻ㈃
   * ?곕え ?ш굔 醫뚰몴濡???꺼 洹몃━吏 ?딄퀬 ?ㅼ젣 醫뚰몴瑜?吏??以묒떖?쇰줈 ?ъ슜?쒕떎.
   */
  const slenoRtkFocusCenter =
    demoMode
      ? pickSlenoRtkFocusCenter(mapLocations)
      : null;

  const mapFocusCenter =
    slenoRtkFocusCenter
    ?? (!eventCenter
      ? liveCenter
      : eventToLiveDistance > 0.08
        ? liveCenter
        : eventCenter);
  const coordinateOutlierKeys = new Set(
    liveCenter
      ? mapLocations
          .filter((item) => Math.hypot(item.longitude - liveCenter[0], item.latitude - liveCenter[1]) > 0.08)
          .map(locationKey)
      : [],
  );
  const selectedLocation = mapLocations.find((location) => locationKey(location) === selectedLocationKey) ?? null;
  const selectedTelemetryHistory = selectedLocation
    ? telemetrySamples.filter((sample) => sample.assetId === selectedLocation.id).slice(-20).reverse()
    : [];
  const downloadSelectedTelemetry = () => {
    if (!selectedLocation || selectedTelemetryHistory.length === 0) return;
    const payload = { exportedAt: new Date().toISOString(), eventId: overview?.event.eventId, assetId: selectedLocation.id, samples: [...selectedTelemetryHistory].reverse() };
    const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${selectedLocation.id}-telemetry-history.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };
  const selectedCommunicationPath = selectedLocation ? communicationPath(selectedLocation) : null;
  const selectedPositioningWarning = selectedLocation && isPositioningLocation(selectedLocation)
    ? positioningWarning(selectedLocation)
    : null;
  const selectedCommunicationProfile = selectedLocation ? communicationProfile(selectedLocation) : null;
  const dialogLocations = resourceDialogGroup
    ? liveLocations.filter((location) => resourceDialogGroup === "ALL"
      || (resourceDialogGroup === "ALL_ASSETS" ? location.kind === "asset" : resourceGroupOf(location) === resourceDialogGroup))
    : [];
  const topologyLabels = {
    endpoints: topologyLabelsFor(overview, "ENDPOINT"),
    field: topologyLabelsFor(overview, "FIELD"),
    command: topologyLabelsFor(overview, "COMMAND"),
    backhaul: topologyLabelsFor(overview, "BACKHAUL"),
    cloud: topologyLabelsFor(overview, "CLOUD"),
  };
  const topologyDataStatus = overview?.topology.nodes.length
    ? `${overview.topology.nodes.length}媛??몃뱶 쨌 ${overview.topology.links.length}媛??곌껐`
    : "?댁슜 湲곗? 援ъ꽦";
  const externalIntegrationItems = Object.values(externalIntegrationStatus);
  const failedExternalIntegrations = externalIntegrationItems.filter(
    (item) => item.status === "error",
  ).length;

  const fieldApiHealth = evaluateFieldApiHealth({
    lastSuccessAt: lastUpdatedAt,
    failedIntegrations: failedExternalIntegrations,
    totalIntegrations: externalIntegrationItems.length,
    retrying,
    staleAfterMs: POLL_INTERVAL_MS * 5,
    offlineAfterMs: POLL_INTERVAL_MS * 15,
  });

  const fieldApiHealthText = fieldApiHealthLabel(fieldApiHealth);
  const fieldApiLastSuccessText = formatLastSuccessAge(lastUpdatedAt);

  const communicationKpis = useMemo(() => {
    if (!overview) return [];
    const telemetryMetrics = telemetrySamples.length ? calculateTelemetryMetrics(telemetrySamples, PROJECT_ENHANCED_TARGET.locationUpdateSeconds) : null;
    const deployment = overviewKpiValue(overview, "NETWORK_DEPLOYMENT_TIME");
    const freshness = overviewKpiValue(overview, "LOCATION_LATENCY") ?? telemetryMetrics?.averageLatencySec ?? null;
    const sharing = overviewKpiValue(overview, "SHARING_SUCCESS") ?? telemetryMetrics?.sharingSuccessPct ?? null;
    const availability = overviewKpiValue(overview, "NETWORK_AVAILABILITY") ?? telemetryMetrics?.availabilityPct ?? null;
    return [
      { id: "deployment", label: "?듭떊留?援ъ텞?쒓컙", value: deployment, unit: "遺?, target: PROJECT_ENHANCED_TARGET.networkDeploymentMinutes, direction: "MAX" as const, icon: "NET" },
      { id: "freshness", label: "?꾩튂?뺣낫 媛깆떊", value: freshness, unit: "珥?, target: PROJECT_ENHANCED_TARGET.locationUpdateSeconds, direction: "MAX" as const, icon: "GPS" },
      { id: "sharing", label: "?뺣낫怨듭쑀 ?깃났瑜?, value: sharing, unit: "%", target: PROJECT_ENHANCED_TARGET.sharingSuccessPct, direction: "MIN" as const, icon: "SEQ" },
      { id: "availability", label: "?ㅽ듃?뚰겕 媛?⑸쪧", value: availability, unit: "%", target: PROJECT_ENHANCED_TARGET.availabilityPct, direction: "MIN" as const, icon: "LINK" },
    ].map((item) => ({ ...item, state: fieldKpiState(item.value, item.target, item.direction) }));
  }, [overview, telemetrySamples]);
  const fieldPrimaryDrone = (localFieldMode || localE2EMode)
    ? (localFieldMode && fieldPreviewMode ? fieldScenarioLocations : liveLocations)
        .find((location) => resourceGroupOf(location) === "UAV") ?? null
    : null;
  const fieldVideoAssetId = fieldPrimaryDrone?.id
    ?? (localE2EMode ? "e2e-md1000-canonical-uuid" : null);

  useEffect(() => {
    let active = true;

    if (!fieldVideoAssetId || fieldPreviewMode) {
      setFieldVideoChannels([]);
      setFieldVideoLoading(false);
      return () => { active = false; };
    }

    const loadVideoChannels = async () => {
      setFieldVideoLoading(true);

      try {
        const result = await forestApi.videoChannels(fieldVideoAssetId);

        if (active) {
          setFieldVideoChannels(Array.isArray(result.data) ? result.data : []);
        }
      } catch {
        if (active) setFieldVideoChannels([]);
      } finally {
        if (active) setFieldVideoLoading(false);
      }
    };

    void loadVideoChannels();

    const timer = window.setInterval(() => {
      void loadVideoChannels();
    }, 5000);

    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [fieldVideoAssetId, fieldPreviewMode]);

  const fieldPrimaryAsset = (localFieldMode || localE2EMode) && fieldPrimaryDrone
    ? overview?.assets.find((asset) =>
        String(asset.assetId ?? "") === fieldPrimaryDrone.id
        || String(asset.assetCode ?? "") === fieldPrimaryDrone.sourceAssetId
        || String(asset.assetCode ?? "") === fieldPrimaryDrone.id,
      ) ?? null
    : null;
  const fieldPrimaryAttributes = fieldPrimaryAsset?.attributes && typeof fieldPrimaryAsset.attributes === "object"
    ? fieldPrimaryAsset.attributes as Record<string, unknown>
    : {};
  const fieldSequenceSummary = localFieldMode
    ? calculatePacketSequence(telemetrySamples, fieldPrimaryDrone?.id, 100)
    : null;

  const fieldLinkQuality =
    fieldPrimaryAttributes.linkQuality &&
    typeof fieldPrimaryAttributes.linkQuality === "object"
      ? fieldPrimaryAttributes.linkQuality as Record<string, unknown>
      : {};

  const linkReceived = Number(fieldLinkQuality.windowReceived);
  const linkLost = Number(fieldLinkQuality.windowLost);
  const linkExpected = Number(fieldLinkQuality.windowExpected);
  const linkLossPct = Number(fieldLinkQuality.packetLossPct);

  const fieldSequenceReceived = fieldPreviewMode
    ? 96
    : Number.isFinite(linkReceived)
      ? linkReceived
      : fieldSequenceSummary?.received ?? 0;

  const fieldSequenceLost = fieldPreviewMode
    ? 4
    : Number.isFinite(linkLost)
      ? linkLost
      : fieldSequenceSummary?.lost ?? 0;

  const fieldSequenceLossPct = fieldPreviewMode
    ? 4
    : Number.isFinite(linkLossPct)
      ? linkLossPct
      : fieldSequenceSummary?.lossPct ?? null;

  const fieldMavlinkVersion = Number(
    fieldPrimaryAttributes.mavlinkVersion ??
    fieldLinkQuality.mavlinkVersion
  );

  const fieldSystemId = Number(
    fieldPrimaryAttributes.systemId ??
    fieldLinkQuality.mavlinkSystemId
  );

  const fieldComponentId = Number(
    fieldPrimaryAttributes.componentId ??
    fieldLinkQuality.mavlinkComponentId
  );
  const fieldSourceAddress = text(fieldPrimaryAttributes.sourceAddress, fieldPreviewMode ? "127.0.0.1:64361" : "?섏떊 ?湲?);
  const fieldTelemetryAgeSec = fieldPrimaryDrone?.observedAt
    ? Math.max(0, Math.floor((Date.now() - new Date(fieldPrimaryDrone.observedAt).getTime()) / 1000))
    : null;
  const fieldLinkHealth = fieldPrimaryDrone?.observedAt
    ? classifyLinkHealth(
        fieldPrimaryDrone.observedAt,
        new Date(),
        fieldPrimaryDrone.expectedTelemetryIntervalSec ?? 3,
      )
    : null;

  /*
   * Semantic Mission fallback PoC
   *
   * MOCK packet is generated only in preview mode.
   * LIVE operation never fabricates predicted operational data.
   */
  const semanticFallbackPacket = fieldPreviewMode && fieldPrimaryDrone
    ? encodeSemanticMissionMock({
        incidentId: selectedId ?? "preview-incident",
        assetId: fieldPrimaryDrone.id,
        observedAt: new Date().toISOString(),
        sourceBytes: 256_000,
        position: {
          longitude: fieldPrimaryDrone.longitude,
          latitude: fieldPrimaryDrone.latitude,
          altitudeM: fieldPrimaryDrone.altitude ?? undefined,
        },
        fire: {
          detected: true,
          confidence: 0.68,
          riskLevel: "POC",
        },
      })
    : null;

  const semanticFallbackDecision = decideSemanticFallback(
    fieldPreviewMode
      ? "DISCONNECTED"
      : (fieldLinkHealth ?? "DISCONNECTED"),
    semanticFallbackPacket,
    new Date(),
  );

  const semanticFallbackActive =
    semanticFallbackDecision.mode === "SEMANTIC_POC";
  const fieldTwinState = fieldPreviewMode
    ? "PREVIEW"
    : fieldPrimaryDrone == null
      ? "WAITING"
      : fieldLinkHealth === "CONNECTED"
        ? "LIVE"
        : fieldLinkHealth === "DELAYED"
          ? "STALE"
          : "OFFLINE";
  const fieldTwinLabel = fieldTwinState === "LIVE"
    ? "PHYSICAL ??DIGITAL SYNC"
    : fieldTwinState === "STALE"
      ? "SYNC DELAY"
      : fieldTwinState === "OFFLINE"
        ? "PHYSICAL LINK OFFLINE"
        : fieldTwinState === "PREVIEW"
          ? "PREVIEW TWIN 쨌 NOT FLIGHT"
          : "WAITING FOR PHYSICAL STATE";
  const fieldDisplay = {
    altitude: fieldPrimaryDrone?.altitude ?? (fieldPreviewMode ? 126 : null),
    speed: fieldPrimaryDrone?.groundSpeedMps ?? (fieldPreviewMode ? 8.4 : null),
    heading: fieldPrimaryDrone?.headingDeg ?? (fieldPreviewMode ? 132 : null),
    battery: fieldPrimaryDrone?.batteryPct ?? (fieldPreviewMode ? 84 : null),
    signal: fieldPrimaryDrone?.signalStrengthDbm ?? (fieldPreviewMode ? -61 : null),
    flightMode: fieldPrimaryDrone?.flightMode ?? (fieldPreviewMode ? "LOITER" : null),
    armed: fieldPrimaryDrone?.armed ?? (fieldPreviewMode ? true : null),
    latitude: fieldPrimaryDrone?.latitude ?? (fieldPreviewMode ? 36.321742 : null),
    longitude: fieldPrimaryDrone?.longitude ?? (fieldPreviewMode ? 127.414883 : null),
  };
  const fieldSyncPercent = fieldTwinState === "LIVE" ? 100
    : fieldTwinState === "PREVIEW" ? 100
      : fieldTwinState === "STALE" ? 62
        : fieldTwinState === "OFFLINE" ? 0
          : 0;
  /* PHASE_5_4_FIELD_FRESHNESS */
  const fieldFreshnessState =
    fieldPreviewMode
      ? "PREVIEW"
      : fieldTelemetryAgeSec == null
        ? "WAITING"
        : fieldLinkHealth === "CONNECTED"
          ? "LIVE"
          : fieldLinkHealth === "DELAYED"
            ? "STALE"
            : "OFFLINE";

  const fieldFreshnessLabel =
    fieldFreshnessState === "LIVE"
      ? "LIVE 쨌 ?뺤긽 ?섏떊"
      : fieldFreshnessState === "STALE"
        ? "STALE 쨌 媛깆떊 吏??
        : fieldFreshnessState === "OFFLINE"
          ? "OFFLINE 쨌 ?섏떊 以묐떒"
          : fieldFreshnessState === "PREVIEW"
            ? "PREVIEW 쨌 SIMULATED"
            : "WAITING 쨌 ?꾩튂 ?섏떊 ?湲?;

  const fieldFreshnessDetail =
    fieldPreviewMode
      ? "DEMO DATA 쨌 NOT FLIGHT"
      : fieldTelemetryAgeSec == null
        ? "GLOBAL_POSITION_INT(33) ?湲?
        : `留덉?留??꾩튂 ?섏떊 ${fieldTelemetryAgeSec}s ??;

  /* PHASE_5_5_FIELD_SUCCESS_GATE */
  const fieldHasCorePosition = Boolean(
    fieldPrimaryDrone
    && fieldPrimaryDrone.latitude != null
    && fieldPrimaryDrone.longitude != null
    && Number.isFinite(fieldPrimaryDrone.latitude)
    && Number.isFinite(fieldPrimaryDrone.longitude)
  );

  const fieldPipelineMapState =
    fieldPreviewMode
      ? "PREVIEW"
      : fieldHasCorePosition
        ? fieldFreshnessState
        : "WAIT";

  const fieldPipelineRows = [
    {
      id: "uplink",
      label: "QGC / Uplink",
      state: fieldPreviewMode ? "PREVIEW" : "CHECK",
      detail: fieldPreviewMode
        ? "SIMULATED"
        : "CHECK_FIELD_MD1000.ps1",
    },
    {
      id: "core",
      label: "Core Position",
      state: fieldPreviewMode || fieldHasCorePosition ? "OK" : "WAIT",
      detail: fieldPreviewMode
        ? "PREVIEW POSITION"
        : fieldHasCorePosition
          ? "MSG33 POSITION RECEIVED"
          : "GLOBAL_POSITION_INT(33) WAIT",
    },
    {
      id: "twin",
      label: "Map Twin",
      state: fieldPreviewMode
        ? "PREVIEW"
        : fieldHasCorePosition
          ? "OK"
          : "WAIT",
      detail: fieldPreviewMode
        ? "SIMULATED TWIN"
        : fieldHasCorePosition
          ? "MARKER / TRAIL READY"
          : "POSITION REQUIRED",
    },
    {
      id: "freshness",
      label: "Freshness",
      state: fieldPipelineMapState,
      detail: fieldPreviewMode
        ? "SIMULATED"
        : fieldTelemetryAgeSec == null
          ? "NO POSITION"
          : `${fieldTelemetryAgeSec}s`,
    },
  ];

  const eventSwitching = Boolean(overview && overview.event.eventId !== selectedId);
  const toggleLayer = useCallback((layerId: string) => {
    setVisibleLayerIds((current) => {
      const next = new Set(current);
      if (next.has(layerId)) next.delete(layerId); else next.add(layerId);
      return next;
    });
  }, []);
  const toggleResourceGroup = useCallback((group: ResourceGroup) => {
    setVisibleResourceGroups((current) => {
      const next = new Set(current);
      if (next.has(group)) next.delete(group); else next.add(group);
      return next;
    });
  }, []);
  const handleLocationSelect = useCallback((location: LiveLocation) => {
    setTopologyLocationKey(null);
    setSelectedLocationKey(locationKey(location));
  }, []);
  const handleLocationTopology = useCallback((location: LiveLocation) => {
    const key = locationKey(location);
    setSelectedLocationKey(null);
    setResourceDialogGroup(null);
    setTopologyLocationKey((current) => current === key ? null : key);
  }, []);
  const handleRetry = useCallback(async () => {
    setRetrying(true);
    setError(null);
    try {
      await refreshEvents();
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : "?ш굔 紐⑸줉 議고쉶 ?ㅽ뙣");
    } finally {
      setEventsLoaded(true);
      setRetrying(false);
    }
  }, [refreshEvents]);

  return (
<main className={`unified-disaster-board ${displayClassName}${commandShellMode ? " is-field-mode" : ""}${SHOW_VALIDATION_UI ? "" : " final-ops-ui"}`} aria-label="?? ?? ?? ??">
      {error && <p className="unified-disaster-error" role="status"><strong>?곗씠??媛깆떊 吏??/strong><span>{error}</span><small>{overview ? "留덉?留??뺤긽 ?곗씠?곕? ?좎??⑸땲??" : "?곌껐???ㅼ떆 ?뺤씤?섍퀬 ?덉뒿?덈떎."}</small></p>}
      {!overview && (
        <section className="dashboard-readiness" aria-live="polite">
          <header>
            <div className="readiness-brand"><span>?곕┝泥?/span><strong>?곕┝?щ궃 ?듯빀?곹솴??/strong><small>FOREST DISASTER COMMON OPERATIONAL PICTURE</small></div>
            <div className="readiness-actions">
              {SHOW_VALIDATION_UI && <button type="button" className="requirements-open" onClick={() => setRequirementsOpen(true)}>湲곕뒫 寃利??꾪솴</button>}
              <button type="button" className="asset-registry-open" onClick={() => { window.location.href = "/device"; }}>?먯궛 ?깅줉쨌愿由?/button>
              <div className={`readiness-connection ${error ? "is-error" : eventsLoaded ? "is-ready" : "is-loading"}`}><i />{error ? "?곌껐 ?먭? ?꾩슂" : eventsLoaded ? "?곌껐 ?뺤긽" : "?곗씠???곌껐 以?}</div>
            </div>
          </header>
          <div className="readiness-body">
            <div className="readiness-symbol" aria-hidden="true"><span /><i /><b /></div>
            <div>
              <p>{error ? "?듯빀 ?곗씠???곌껐???뺤씤??二쇱꽭?? : eventsLoaded ? "?꾩옱 吏꾪뻾 以묒씤 ?щ궃???놁뒿?덈떎" : "?곕┝?щ궃 ?댁쁺 ?뺣낫瑜?遺덈윭?ㅺ퀬 ?덉뒿?덈떎"}</p>
              <h1>{error ? "?곹솴?먯쓣 以鍮꾪븯吏 紐삵뻽?듬땲?? : eventsLoaded ? "?뺤긽 ?湲??곹깭" : "?곹솴??以鍮?以?}</h1>
              <span>{error ? "湲곗〈 ?곗씠?곕뒗 蹂寃쎈릺吏 ?딆븯?듬땲?? ?곌껐 蹂듦뎄 ??理쒖떊 ?곹솴???ㅼ떆 遺덈윭?듬땲??" : eventsLoaded ? "?щ궃 ?ш굔???묒닔?섎㈃ 吏?꽷룹옄?먃룻넻?좊쭩쨌寃쎈낫 ?꾪솴???먮룞?쇰줈 ?쒖떆?⑸땲??" : "?ш굔, ?꾩옣 ?먯썝, ?듭떊留앷낵 寃쎈낫 ?곹깭瑜??뺤씤?섎뒗 以묒엯?덈떎."}</span>
              {error && <button type="button" onClick={handleRetry} disabled={retrying}>{retrying ? "?ㅼ떆 ?곌껐 以묅? : "?곌껐 ?ㅼ떆 ?뺤씤"}</button>}
            </div>
          </div>
          <footer>
            <span><i /> ?ш굔 ?뺣낫</span><span><i /> ?꾩옣 ?먯썝</span><span><i /> ?듭떊留??곹깭</span><span><i /> ?꾪뿕 寃쎈낫</span>
          </footer>
        </section>
      )}

      {overview && (
        <>
        <header className="map-command-header">
          <div className="service-brand"><span>??/span><div><strong>?곕┝?щ궃 ?듯빀?곹솴??/strong><small>COMMON OPERATIONAL PICTURE</small></div></div>
          <label className="event-selector">
            <span>{eventSwitching ? "?ш굔 ?꾪솚 以? : "?щ궃 ?ш굔"}</span>
            <select value={eventSwitching ? overview.event.eventId : selectedId} onChange={(event) => setSelectedId(event.target.value)} aria-label="?щ궃 ?ш굔 ?좏깮" disabled={eventSwitching}>
              {events.map((event) => <option key={event.eventId} value={event.eventId}>{korean(event.disasterType, "?щ궃")} 쨌 {text(event.eventName, event.eventCode)}</option>)}
            </select>
          </label>
          <div className="header-event-state">
            <b data-type={overview.event.disasterType}>{korean(overview.event.disasterType, "?щ궃")}</b>
            <span>{korean(overview.event.status)}</span>
            <span>{korean(overview.event.severityCode)}</span>
            <small>{text(overview.event.locationName)}</small>
          </div>
          {SHOW_VALIDATION_UI && demoMode && <div className="demo-mode-badge" title="?ㅼ젣 API ?곌껐 ???붾㈃ 寃利앹슜 ?곗씠?곗엯?덈떎"><b>DEMO</b><span>紐⑥쓽 愿???곗씠??/span></div>}
          {localE2EMode && <div className="demo-mode-badge" title="?ㅺ린泥닿? ?꾨땶 濡쒖뺄 synthetic MAVLink 釉뚮씪?곗? E2E?낅땲??><b>E2E</b><span>SYNTHETIC 쨌 NOT FLIGHT</span></div>}
          {localFieldMode && <div className={`demo-mode-badge field-mode-badge${fieldPreviewMode ? " field-preview-badge" : ""}`} title={fieldPreviewMode ? "?붾㈃ ?뺤씤???꾪븳 紐낆떆??誘몃━蹂닿린 ?곗씠?곗엯?덈떎. ?ㅼ젣 鍮꾪뻾 利앷굅媛 ?꾨떃?덈떎." : "?ㅼ젣 MD1000 MAVLink留??섏떊?섎뒗 濡쒖뺄 ?꾩옣 紐⑤뱶?낅땲?? Synthetic feed???ъ슜?섏? ?딆뒿?덈떎."}><b>{fieldPreviewMode ? "誘몃━蹂닿린" : "?꾩옣"}</b><span>{fieldPreviewMode ? "DEMO DATA 쨌 NOT FLIGHT" : "MD1000 ?ㅺ린泥?쨌 MAVLink ?곕룞"}</span></div>}
          {SHOW_VALIDATION_UI && demoMode && <label className="demo-scenario-selector"><span>寃利??쒕굹由ъ삤</span><select aria-label="DEMO 寃利??쒕굹由ъ삤" value={demoScenario} onChange={(event) => { const params = new URLSearchParams(window.location.search); params.set("demo", "1"); params.set("scenario", event.target.value); window.location.search = params.toString(); }}>{DEMO_SCENARIOS.map((scenario) => <option key={scenario.id} value={scenario.id}>{scenario.label}</option>)}</select></label>}
          {localFieldMode && <button type="button" className="field-preview-toggle" onClick={() => { const params = new URLSearchParams(window.location.search); params.set("field", "1"); if (fieldPreviewMode) params.delete("preview"); else params.set("preview", "1"); window.location.search = params.toString(); }}>{fieldPreviewMode ? "?ㅻ뜲?댄꽣 蹂닿린" : "誘몃━蹂닿린 ?곗씠??}</button>}
          <nav className="header-summary" aria-label="?댁쁺 ?꾪솴">
            <button
  type="button"
  onClick={() => {
    setSelectedLocationKey(null);
    setResourceDialogGroup("ALL_ASSETS");
  }}
>
  <span>?ъ엯 ?λ퉬</span>
  <b>{overview.assets.length}</b>
</button>
            <button type="button" onClick={() => setOperationsTab("layers")}><span>?몄썝</span><b>{overview.personnel.length}</b></button>
            <button type="button" onClick={() => setOperationsTab("networks")}><span>?듭떊留?/span><b>{overview.networks.length}</b></button>
            <button type="button" data-alert={activeAlertCount > 0} onClick={() => setOperationsTab("alerts")}><span>寃쎈낫</span><b>{activeAlertCount}</b></button>
          </nav>
          <div className="command-primary-actions">
            <button type="button" className="asset-registry-open" onClick={() => { window.location.href = "/device"; }}>?먯궛 ?깅줉쨌愿由?/button>
            {SHOW_VALIDATION_UI && <button type="button" className="requirements-open" onClick={() => setRequirementsOpen(true)}>湲곕뒫 寃利??꾪솴</button>}
          </div>
          <button type="button" className="asset-status-open" onClick={() => { setSelectedLocationKey(null); setResourceDialogGroup("ALL"); }}>?ш굔 ?ъ엯 ?먯궛</button>
          <time className="last-updated" title={lastUpdatedAt?.toLocaleString("ko-KR")}><i /> 理쒓렐 媛깆떊 {lastUpdatedAt ? relativeTime(lastUpdatedAt.toISOString()) : "?湲?以?}</time>
        </header>
        {SHOW_VALIDATION_UI && <section className="field-kpi-strip" aria-label="?꾩옣 ?듭떊 KPI 4醫?>
          {communicationKpis.map((item) => (
            <article key={item.id} data-state={item.state}>
              <span className="field-kpi-icon" aria-hidden="true">{item.icon}</span>
              <div>
                <small>{item.label}</small>
                <strong>{item.value == null ? "痢≪젙 ?湲? : `${item.value.toFixed(item.unit === "%" ? 1 : 1)}${item.unit}`}</strong>
              </div>
              <em>{item.state === "PASS" ? "PASS" : item.state === "CHECK" ? "CHECK" : "?湲?}</em>
              <p>湲곗? {item.direction === "MAX" ? "?? : "??}{item.target}{item.unit}</p>
            </article>
          ))}
          <aside className="field-kpi-context">
            <div className="field-kpi-context-title">
              <b>
                {localFieldMode
                  ? fieldPreviewMode
                    ? "FIELD ?붾㈃ 誘몃━蹂닿린"
                    : "?ㅺ린泥??듭떊 媛먯떆"
                  : localE2EMode
                    ? "E2E ?듭떊 寃利?
                    : demoMode
                      ? "紐⑥쓽 愿???듭떊"
                      : "?꾩옣 ?듭떊 ?곹깭"}
              </b>
            </div>

            <div
              className="field-kpi-context-status"
              title={
                localE2EMode
                  ? "LOCAL E2E 쨌 ?ㅺ린泥닿? ?꾨땶 synthetic 寃利?
                  : localFieldMode && !fieldPreviewMode
                    ? "MD1000 ?ㅺ린泥?쨌 MAVLink v2"
                    : undefined
              }
            >
              <small
                className="field-kpi-mode-chip"
                data-mode={
                  localFieldMode && !fieldPreviewMode
                    ? "physical"
                    : localE2EMode
                      ? "synthetic"
                      : demoMode || fieldPreviewMode
                        ? "demo"
                        : "live"
                }
              >
                {localFieldMode && !fieldPreviewMode
                  ? "SYNTHETIC OFF"
                  : localE2EMode
                    ? "SYNTHETIC E2E"
                    : demoMode || fieldPreviewMode
                      ? "DEMO DATA"
                      : "LIVE DATA"}
              </small>
              {!demoMode && (
                <div
                  className="field-api-health"
                  data-state={fieldApiHealth.toLowerCase()}
                  title={fieldApiLastSuccessText}
                  role="status"
                >
                  <i />
                  <span>{fieldApiHealthText}</span>
                </div>
              )}
            </div>
          </aside>
        </section>}
<section className={`dashboard-map-stage${commandShellMode ? " field-command-stage" : " asset-panel-collapsed"}`} aria-label="?? ?? ?? ???">
          {SHOW_VALIDATION_UI && demoMode && (
            <div className="semantic-mission-poc-overlay">
              <SemanticMissionPocPanel />
            </div>
          )}
          <section className="live-location-panel" aria-label="?ㅼ떆媛??꾩옣 ?꾩튂">
            {!demoMode && overview.liveDroneTelemetry && <div
              className="telemetry-connection-status"
              role="status"
              title={localFieldMode ? "?꾩옱 ?꾩튂??CRC 寃利앸맂 MAVLink GLOBAL_POSITION_INT(33)留??ъ슜?⑸땲??" : undefined}
              data-local-e2e={localE2EMode ? "true" : undefined}
              data-e2e-live={localE2EMode ? overview.liveDroneTelemetry.live : undefined}
              data-e2e-stale={localE2EMode ? overview.liveDroneTelemetry.stale : undefined}
              data-e2e-offline={localE2EMode ? overview.liveDroneTelemetry.offline : undefined}
              data-local-field={localFieldMode ? "true" : undefined}
              data-field-live={localFieldMode ? overview.liveDroneTelemetry.live : undefined}
              data-field-stale={localFieldMode ? overview.liveDroneTelemetry.stale : undefined}
              data-field-offline={localFieldMode ? overview.liveDroneTelemetry.offline : undefined}
            >
              {localFieldMode ? (fieldPreviewMode ? 'MD1000 ?붾㈃ 誘몃━蹂닿린 쨌 ?곕え ?곗씠??쨌 ?ㅻ퉬???꾨떂' : 'MD1000 ?ㅼ떆媛?湲곗껜 ?꾩튂') : 'MAVLink ?꾩튂 ?곕룞'} 쨌 {localFieldMode
                ? (fieldPreviewMode ? 'PREVIEW ONLY' : fieldCoreStatusLabel(overview.liveDroneTelemetry.status, overview.liveDroneTelemetry.matched))
                : overview.liveDroneTelemetry.status === 'CONNECTED' ? 'Core 議고쉶 ?뺤긽' : 'Core 議고쉶 ?ㅽ뙣 쨌 留덉?留??섏떊媛??좎?'}
              {' 쨌 '}吏???곌껐 {overview.liveDroneTelemetry.matched}? 쨌 LIVE {overview.liveDroneTelemetry.live} 쨌 STALE {overview.liveDroneTelemetry.stale} 쨌 OFFLINE {overview.liveDroneTelemetry.offline}
              {' 쨌 '}ID 誘몄뿰寃?{overview.liveDroneTelemetry.unmatched}?
              {overview.liveDroneTelemetry.unmatched > 0 && ' 쨌 ?먯궛 肄붾뱶 ?먮뒗 telemetrySourceAssetId ?뺤씤'}
            </div>}
            <div className="live-location-layout">
              <div className="location-map" role="region" aria-label={`?꾩옣 ?꾩튂 ${liveLocations.length}嫄?}>
                <LivePositionMap
                  locations={visibleLocations}
                  changedUntil={changedUntil}
                  highlightDurationMs={highlightDurationMs}
                  eventCenter={eventCenter}
                  focusCenter={mapFocusCenter}
                  eventId={overview.event.eventId}
                  showResources={visibleLayerIds.has("resources")}
                  showEvent={visibleLayerIds.has("event")}
                  selectedKey={topologyLocationKey ?? selectedLocationKey}
                  onLocationSelect={handleLocationSelect}
                  onLocationDoubleClick={(location) => setVideoDrone(location)}
                  onLocationTopology={handleLocationTopology}
                  topology={overview.topology}
                  topologyFocusKey={topologyLocationKey}
                  showTopology={visibleLayerIds.has("topology")}
                  referenceTimeMs={playbackSnapshot ? Date.parse(playbackSnapshot.at) + 59_999 : Date.now()}
                  domainLayers={mapDomainLayers}
                  visibleLayerIds={visibleLayerIds}
                />
                <MapTimelinePlayer
                  snapshots={timelineSnapshots}
                  activeIndex={timelineIndex}
                  playing={timelinePlaying}
                  loading={timelineLoading}
                  onPlayToggle={handleTimelinePlayToggle}
                  onIndexChange={handleTimelineIndexChange}
                  onLive={handleTimelineLive}
                />
                {eventToLiveDistance > 0.08 && (
                  <p className="map-coordinate-warning" role="status">
                    <strong>醫뚰몴 ?뺥빀???뺤씤 ?꾩슂</strong>
                    ?ш굔 湲곗??먭낵 ?꾩옣 ?먯궛 以묒떖????{eventToLiveDistanceKm.toFixed(1)}km ?⑥뼱???덉뼱 ?먯궛 以묒떖?쇰줈 ?쒖떆?⑸땲??
                  </p>
                )}
                {liveLocations.length === 0 && <p>?섏떊???꾩튂媛 ?놁뒿?덈떎.</p>}
              </div>
              <OperationsPanel
                overview={overview}
                visibleLayerIds={visibleLayerIds}
                onLayerToggle={toggleLayer}
                visibleResourceGroups={visibleResourceGroups}
                onResourceGroupToggle={toggleResourceGroup}
                onResourceGroupInspect={(group) => { setSelectedLocationKey(null); setResourceDialogGroup(group); }}
                locations={fieldPreviewMode ? fieldScenarioLocations : liveLocations}
                lastUpdatedAt={lastUpdatedAt}
                activeTab={operationsTab}
                onActiveTabChange={setOperationsTab}
                externalIntegrationStatus={externalIntegrationStatus}
                onRefreshExternalIntegrations={() => {
                  void refreshExternalIntegrations();
                }}
                telemetryStreamStatus={telemetryStreamStatus}
                onOpenDroneVideo={(location) => setVideoDrone(location)}
                telemetrySamples={telemetrySamples}
              />

              <FieldLinkChatWidget
                eventId={String(
                  overview.event.eventId ??
                  DEFAULT_EVENT_ID
                )}
              />

              {(localFieldMode || localE2EMode || SHOW_VALIDATION_UI) && <aside className="field-command-inspector" aria-label="MD1000 ?λ퉬 ?곸꽭 ?뺣낫">
                <header>
                  <div><small>?λ퉬 ?곸꽭 ?뺣낫</small><strong>{fieldPrimaryDrone?.label ?? (fieldPreviewMode ? "MD1000 誘몃━蹂닿린" : "二?湲곗껜 ?섏떊 ?湲?)}</strong></div>
                  <em
                    className="field-freshness-chip"
                    data-state={fieldFreshnessState.toLowerCase()}
                  >
                    {fieldFreshnessState}
                  </em>
                </header>
                <div
                  className="field-freshness-banner"
                  data-state={fieldFreshnessState.toLowerCase()}
                >
                  <strong>{fieldFreshnessLabel}</strong>
                  <span>{fieldFreshnessDetail}</span>
                </div>

                {semanticFallbackActive && (
                  <section
                    className="semantic-fallback-poc"
                    aria-label="Semantic AI PoC fallback status"
                  >
                    <header>
                      <div>
                        <strong>SEMANTIC AI 쨌 PoC</strong>
                        <small>?듭떊 ?⑥젅 fallback ?쒓컖??/small>
                      </div>
                      <span>EXPERIMENTAL</span>
                    </header>

                    <div className="semantic-fallback-badges">
                      <b>MOCK</b>
                      <b>PREDICTED</b>
                      <b>NOT LIVE VIDEO</b>
                    </div>

                    <div className="semantic-fallback-grid">
                      <article>
                        <small>Fallback Mode</small>
                        <strong>{semanticFallbackDecision.mode}</strong>
                      </article>
                      <article>
                        <small>Semantic State</small>
                        <strong>{semanticFallbackDecision.semanticState}</strong>
                      </article>
                      <article>
                        <small>Source</small>
                        <strong>{semanticFallbackDecision.packet?.source ?? "-"}</strong>
                      </article>
                      <article>
                        <small>Confidence</small>
                        <strong>
                          {semanticFallbackDecision.packet?.observations[0]
                            ? `${Math.round(
                                semanticFallbackDecision.packet.observations[0]
                                  .confidence * 100,
                              )}%`
                            : "-"}
                        </strong>
                      </article>
                    </div>

                    <footer>
                      留덉?留?愿痢?湲곕컲 ?덉륫 ?쒖떆 쨌 ?ㅼ젣 LIVE ?곸긽 ?먮뒗 愿痢??곗씠?곌? ?꾨떃?덈떎.
                    </footer>
                  </section>
                )}

                <section
                  className="field-success-gate"
                  aria-label="MD1000 FIELD success gate"
                >
                  <header>
                    <div>
                      <small>FIELD SUCCESS GATE</small>
                      <strong>{fieldPrimaryDrone ? "MD1000 ?ㅺ린泥??곕룞" : fieldPreviewMode ? "MD1000 誘몃━蹂닿린 ?곕룞" : "?ㅺ린泥??곕룞 ?湲?}</strong>
                    </div>
                    <em data-state={fieldPipelineMapState.toLowerCase()}>
                      {fieldPipelineMapState}
                    </em>
                  </header>

                  <div className="field-success-gate-list">
                    {fieldPipelineRows.map((row) => (
                      <article key={row.id}>
                        <span>{row.label}</span>
                        <b data-state={row.state.toLowerCase()}>
                          {row.state}
                        </b>
                        <small>{row.detail}</small>
                      </article>
                    ))}
                  </div>

                  <footer>
                    <span>POSITION SOURCE</span>
                    <strong>MAVLink GLOBAL_POSITION_INT (MSG 33)</strong>
                  </footer>
                </section>

                <div className="field-inspector-identity">
                  <span>{fieldPrimaryDrone ? `臾댁씤湲?쨌 ${fieldPrimaryDrone.label}` : fieldPreviewMode ? "臾댁씤湲?쨌 MD1000 PREVIEW" : "臾댁씤湲?쨌 誘몄닔??}</span>
                  <b>{fieldPrimaryDrone?.status ?? "?ㅺ린泥??꾩튂 ?섏떊 ?湲?}</b>
                  <small>{fieldPreviewMode ? "DEMO DATA 쨌 NOT FLIGHT" : "GLOBAL_POSITION_INT(33) 湲곕컲 ?꾩옱 ?꾩튂"}</small>
                </div>
                <section className="field-twin-status" data-state={fieldTwinState.toLowerCase()} aria-label="MD1000 ?붿????몄쐢 ?숆린???곹깭">
                  <header>
                    <span>Digital Twin</span>
                    <strong>{fieldTwinLabel}</strong>
                  </header>
                  <div className="field-twin-grid">
                    <article><small>Physical Asset</small><b>{fieldPrimaryDrone?.label ?? (fieldPreviewMode ? "MD1000 PREVIEW" : "-")}</b></article>
                    <article><small>Twin State</small><b>{fieldTwinState}</b></article>
                    <article><small>Position Source</small><b>{fieldPreviewMode ? "PREVIEW" : fieldPrimaryDrone ? "MAVLink MSG 33" : "-"}</b></article>
                    <article
                      className="field-freshness-cell"
                      data-state={fieldFreshnessState.toLowerCase()}
                    >
                      <small>Freshness</small>
                      <b>{fieldFreshnessState}</b>
                      <em>
                        {fieldPreviewMode
                          ? "SIMULATED"
                          : fieldTelemetryAgeSec == null
                            ? "-"
                            : `${fieldTelemetryAgeSec}s`}
                      </em>
                    </article>
                    <article><small>Latitude</small><b>{fieldDisplay.latitude == null ? "-" : fieldDisplay.latitude.toFixed(6)}</b></article>
                    <article><small>Longitude</small><b>{fieldDisplay.longitude == null ? "-" : fieldDisplay.longitude.toFixed(6)}</b></article>
                  </div>
                  <div className="field-sync-meter" aria-label={`Digital Twin sync ${fieldSyncPercent}%`}>
                    <span style={{ width: `${fieldSyncPercent}%` }} />
                  </div>
                </section>
                <nav
                  className="field-inspector-tabs"
                  aria-label="?λ퉬 ?뺣낫 遺꾨쪟"
                  role="tablist"
                >
                  <button
                    type="button"
                    role="tab"
                    aria-selected={fieldInspectorTab === "quality"}
                    className={fieldInspectorTab === "quality" ? "active" : ""}
                    onClick={() => setFieldInspectorTab("quality")}
                  >
                    ?듭떊 ?덉쭏
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={fieldInspectorTab === "details"}
                    className={fieldInspectorTab === "details" ? "active" : ""}
                    onClick={() => setFieldInspectorTab("details")}
                  >
                    ?곸꽭 ?뺣낫
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={fieldInspectorTab === "video"}
                    className={fieldInspectorTab === "video" ? "active" : ""}
                    onClick={() => setFieldInspectorTab("video")}
                  >
                    ?ㅼ떆媛??곸긽
                  </button>
                </nav>

                {fieldInspectorTab === "quality" && (
                <div
                  className="field-inspector-pane field-quality-pane"
                  role="tabpanel"
                >
                <section className="field-seq-summary" aria-label="理쒓렐 SEQ ?듭떊 ?덉쭏">
                  <header><span>理쒓렐 100 SEQ 湲곗?</span><small>{fieldPreviewMode ? "?덉떆 ?곗씠?? : fieldSequenceSummary?.expected ? `SEQ ${fieldSequenceSummary.fromSequence ?? "-"}??{fieldSequenceSummary.toSequence ?? "-"}` : "?섏떊 ?湲?}</small></header>
                  <div className="field-seq-grid">
                    <article><small>Received</small><strong>{fieldSequenceReceived || "-"}</strong></article>
                    <article><small>Lost</small><strong data-alert={fieldSequenceLost > 0}>{fieldSequenceLost || "-"}</strong></article>
                    <article><small>Loss %</small><strong data-alert={(fieldSequenceLossPct ?? 0) >= 3}>{fieldSequenceLossPct == null ? "-" : `${fieldSequenceLossPct.toFixed(1)}%`}</strong></article>
                    <article><small>理쒓렐 ?섏떊</small><strong>{fieldPrimaryDrone ? relativeTime(fieldPrimaryDrone.observedAt) : "?湲?}</strong></article>
                    <article><small>怨좊룄</small><strong>{fieldDisplay.altitude == null ? "-" : `${fieldDisplay.altitude.toFixed(0)}m`}</strong></article>
                    <article><small>?띾룄</small><strong>{fieldDisplay.speed == null ? "-" : `${fieldDisplay.speed.toFixed(1)}m/s`}</strong></article>
                  </div>
                </section>
                <dl className="field-link-diagnostics">
                  <div>
                    <dt>MAVLink</dt>
                    <dd>
                      {Number.isFinite(fieldMavlinkVersion)
                        ? `v${fieldMavlinkVersion}`
                        : "?섏떊 ?湲?}
                    </dd>
                  </div>

                  <div>
                    <dt>SYS / COMP</dt>
                    <dd>
                      {Number.isFinite(fieldSystemId) &&
                      Number.isFinite(fieldComponentId)
                        ? `${fieldSystemId} / ${fieldComponentId}`
                        : "?섏떊 ?湲?}
                    </dd>
                  </div>

                  <div>
                    <dt>MAVLink SEQ</dt>
                    <dd>
                      {Number.isFinite(
                        Number(fieldLinkQuality.mavlinkSequence),
                      )
                        ? String(fieldLinkQuality.mavlinkSequence)
                        : "-"}
                    </dd>
                  </div>

                  <div>
                    <dt>Expected</dt>
                    <dd>
                      {Number.isFinite(
                        Number(fieldLinkQuality.windowExpected),
                      )
                        ? String(fieldLinkQuality.windowExpected)
                        : "-"}
                    </dd>
                  </div>

                  <div>
                    <dt>AVG</dt>
                    <dd>
                      {Number.isFinite(
                        Number(fieldLinkQuality.periodAvgMs),
                      )
                        ? `${Number(
                            fieldLinkQuality.periodAvgMs,
                          ).toFixed(1)}ms`
                        : "-"}
                    </dd>
                  </div>

                  <div>
                    <dt>P95</dt>
                    <dd>
                      {Number.isFinite(
                        Number(fieldLinkQuality.periodP95Ms),
                      )
                        ? `${Number(
                            fieldLinkQuality.periodP95Ms,
                          ).toFixed(1)}ms`
                        : "-"}
                    </dd>
                  </div>

                  <div>
                    <dt>MAX</dt>
                    <dd>
                      {Number.isFinite(
                        Number(fieldLinkQuality.periodMaxMs),
                      )
                        ? `${Number(
                            fieldLinkQuality.periodMaxMs,
                          ).toFixed(1)}ms`
                        : "-"}
                    </dd>
                  </div>
                </dl>
                <section className="field-event-log">
                  <header><strong>?λ퉬 ?대깽??濡쒓렇</strong><small>理쒓렐 ?곹깭</small></header>
                  <ol>
                    {fieldPreviewMode && <>
                      <li><i data-tone="ok" /><time>14:27:35</time><span>?곗씠???섏떊 ?깃났</span><em>SEQ 3287</em></li>
                      <li><i data-tone="ok" /><time>14:27:34</time><span>?곗씠???섏떊 ?깃났</span><em>SEQ 3286</em></li>
                      <li><i data-tone="bad" /><time>14:27:32</time><span>?⑦궥 ?먯떎 媛먯?</span><em>SEQ 3284</em></li>
                      <li><i data-tone="ok" /><time>14:27:31</time><span>?곗씠???섏떊 ?깃났</span><em>SEQ 3283</em></li>
                    </>}
                    {!fieldPreviewMode && telemetrySamples.slice(-4).reverse().map((sample, index) => <li key={`${sample.receivedAt}-${index}`}><i data-tone="ok" /><time>{new Date(sample.receivedAt).toLocaleTimeString("ko-KR", { hour12: false })}</time><span>?붾젅硫뷀듃由??섏떊</span><em>SEQ {sample.sequence ?? "-"}</em></li>)}
                    {!fieldPreviewMode && telemetrySamples.length === 0 && <li className="empty"><span>?ㅺ린泥??붾젅硫뷀듃由??섏떊 ?湲?/span></li>}
                  </ol>
                </section>
                </div>
                )}

                {fieldInspectorTab === "details" && (
                  <div
                    className="field-inspector-pane field-inspector-detail-pane"
                    role="tabpanel"
                  >
                    {fieldPrimaryAsset ? (
                      <dl className="field-twin-detail">
                        <DroneTwinDetail asset={fieldPrimaryAsset} />
                      </dl>
                    ) : (
                      <div className="field-inspector-empty">
                        <strong>?λ퉬 ?곸꽭?뺣낫 ?섏떊 ?湲?/strong>
                        <span>Core?먯꽌 ?깅줉 ?λ퉬? ?ㅼ떆媛??붾젅硫뷀듃由щ? 寃고빀?섎㈃ ?쒖떆?⑸땲??</span>
                      </div>
                    )}
                  </div>
                )}

                {fieldInspectorTab === "video" && (
                  <div
                    className="field-inspector-pane field-inspector-video-pane"
                    role="tabpanel"
                  >
                    <div className="field-video-tab-summary">
                      <span>?ㅼ떆媛??곸긽</span>
                      <strong>
                        {fieldPrimaryDrone?.label ??
                          (fieldPreviewMode
                            ? "MD1000 誘몃━蹂닿린"
                            : "二?湲곗껜 ?섏떊 ?湲?)}
                      </strong>
                      <small>
                        ?깅줉 ?곸긽 梨꾨꼸 {fieldVideoChannels.length}媛?
                      </small>
                    </div>

                    <button
                      type="button"
                      className="field-open-video-button"
                      disabled={!fieldPrimaryDrone}
                      onClick={() => {
                        if (fieldPrimaryDrone) {
                          setVideoDrone(fieldPrimaryDrone);
                        }
                      }}
                    >
                      ?ㅼ떆媛??곸긽 ?닿린
                    </button>

                    {!fieldPrimaryDrone && (
                      <p className="field-video-wait">
                        ?쒕줎 ?붾젅硫뷀듃由ш? ?섏떊?섎㈃ ?곸긽 梨꾨꼸???????덉뒿?덈떎.
                      </p>
                    )}
                  </div>
                )}
              </aside>}
            </div>
            {selectedLocation && <div className="resource-modal-backdrop" role="presentation" onMouseDown={() => setSelectedLocationKey(null)}>
            <section className="selected-location-drawer resource-modal" role="dialog" aria-modal="true" aria-label="?좏깮 ?먯궛 ?곸꽭" onMouseDown={(event) => event.stopPropagation()}>
              <div><span>{assetTypeLabel(selectedLocation.category)}</span><strong>{selectedLocation.label}</strong><small>{coordinateOutlierKeys.has(locationKey(selectedLocation)) ? "醫뚰몴 ?뺥빀???뺤씤 ?꾩슂" : selectedLocation.status}</small></div>
              <dl>
                <div>
                  <dt>?듭떊 ?곹깭</dt>
                  <dd>{selectedLocation.qualityStatus || selectedLocation.status || "?뺤씤 以?}</dd>
                </div>
                <div>
                  <dt>?꾩넚留?/dt>
                  <dd>{selectedLocation.networkMode || "留??뺣낫 ?놁쓬"}</dd>
                </div>
                {!demoMode && <DroneTwinDetail asset={overview.assets.find(asset => asset.assetId === selectedLocation.id) ?? {}} />}
                <div><dt>理쒓렐 ?듭떊</dt><dd>{relativeTime(selectedLocation.observedAt)}</dd></div>
                <div><dt>?꾩튂</dt><dd>{selectedLocation.latitude.toFixed(6)}, {selectedLocation.longitude.toFixed(6)}</dd></div>
                <div><dt>怨좊룄</dt><dd>{selectedLocation.altitude == null ? "?뺤씤 遺덇?" : `${selectedLocation.altitude.toFixed(1)}m`}</dd></div>
                <div><dt>諛고꽣由?/dt><dd>{selectedLocation.batteryPct == null ? "痢≪젙媛??놁쓬" : `${selectedLocation.batteryPct.toFixed(0)}%`}</dd></div>
                <div><dt>?좏샇</dt><dd>{selectedLocation.signalStrengthDbm == null ? "痢≪젙媛??놁쓬" : `${selectedLocation.signalStrengthDbm.toFixed(0)} dBm`}</dd></div>
                <div><dt>吏?걔룹넀??/dt><dd>{selectedLocation.latencyMs == null ? "痢≪젙媛??놁쓬" : `${selectedLocation.latencyMs.toFixed(0)} ms 쨌 ${selectedLocation.packetLossPct?.toFixed(1) ?? "-"}%`}</dd></div>
                <div><dt>?곗씠??諛쒖깮 ?λ퉬</dt><dd>{selectedLocation.sourceAssetId || selectedLocation.id}</dd></div>
                <div><dt>API ?꾨떖 二쇱껜</dt><dd>{selectedLocation.reportedByAssetId ? `${korean(selectedLocation.reportingRole || "GATEWAY")} 쨌 ${selectedLocation.reportedByAssetId}` : "吏곸젒 蹂닿퀬 ?먮뒗 ?뺣낫 誘몄닔??}</dd></div>
              {isPositioningLocation(selectedLocation) && <>
                  <div><dt>痢≪쐞 ?곹깭</dt><dd>{selectedLocation.positioningMethod ? korean(selectedLocation.positioningMethod) : "痢≪쐞?뺣낫 ?섏떊 ??}</dd></div>
                  <div><dt>?덉긽 ?ㅼ감</dt><dd>{selectedLocation.horizontalAccuracyM == null ? "痢≪젙媛??놁쓬" : `짹${selectedLocation.horizontalAccuracyM.toFixed(2)}m`}</dd></div>
                  <div><dt>湲곗?援?蹂댁젙</dt><dd>{correctionStatus(selectedLocation)}</dd></div>
                  <div><dt>?꾩옣 ?꾩넚留?/dt><dd>{selectedLocation.networkMode ? korean(selectedLocation.networkMode) : "留??뺣낫 ?섏떊 ??}</dd></div>
                </>}
                {resourceGroupOf(selectedLocation) === "UAV" && <>
                  <div><dt>鍮꾪뻾 紐⑤뱶</dt><dd>{selectedLocation.flightMode ?? "?섏떊 ??}</dd></div>
                  <div><dt>?쒕룞쨌?꾨Т</dt><dd>{selectedLocation.armed == null ? "?섏떊 ?? : `${selectedLocation.armed ? "ARMED" : "DISARMED"} 쨌 WP ${selectedLocation.missionSequence ?? "-"}`}</dd></div>
                  <div><dt>?띾룄쨌諛⑺뼢</dt><dd>{selectedLocation.groundSpeedMps == null ? "?섏떊 ?? : `${selectedLocation.groundSpeedMps.toFixed(1)}m/s 쨌 ${selectedLocation.headingDeg?.toFixed(0) ?? "-"}째`}</dd></div>
                  <div><dt>鍮꾩긽 ?곹깭</dt><dd>{selectedLocation.emergencyStatus ?? "?뺤긽"}</dd></div>
                </>}
              </dl>
              {selectedTelemetryHistory.length > 0 && <section className="asset-live-history" aria-label={`${selectedLocation.id} ?ㅼ떆媛??섏떊 ?대젰`}>
                <header><div><small>GATEWAY RAW HISTORY</small><strong>理쒓렐 ?꾩튂 ?섏떊 {selectedTelemetryHistory.length}嫄?/strong></div><button type="button" onClick={downloadSelectedTelemetry}>JSON 利앹쟻</button></header>
                <ol>{selectedTelemetryHistory.slice(0, 6).map((sample, index) => <li key={`${sample.observedAt}-${sample.sequence ?? index}`}><time>{new Date(sample.observedAt).toLocaleTimeString("ko-KR")}</time><span>{sample.latitude?.toFixed(6) ?? "-"}, {sample.longitude?.toFixed(6) ?? "-"}</span><em>SEQ {sample.sequence ?? "-"}</em></li>)}</ol>
              </section>}
              {selectedLocation.kind === "asset" && <button type="button" className="asset-log-link" onClick={() => { window.location.href = `/device?assetId=${encodeURIComponent(selectedLocation.id)}`; }}>assetId 濡쒓렇쨌?대젰 議고쉶</button>}
              {isPositioningLocation(selectedLocation) && <p className="positioning-dialog-note">
                <strong>{selectedLocation.category === "RTK_BASE_LPWA_GATEWAY" ? "湲곗?援???븷" : "?꾩튂 ?곗텧 ?먮쫫"}</strong>
                <span>{positioningDescription(selectedLocation)}</span>
              </p>}
              {selectedCommunicationPath && <section className="communication-path" aria-label="?듭떊 ?곌껐 援ъ꽦">
                <header>
                  <strong>?듭떊 ?곌껐 援ъ꽦</strong>
                  <span><i data-medium="wired" />?좎꽑</span>
                  <span><i data-medium="wireless" />臾댁꽑</span>
                </header>
                <div className="communication-path-flow">
                  {selectedCommunicationPath.nodes.map((node, index) => <div className="communication-path-step" key={`${node}-${index}`}>
                    <b>{node}</b>
                    {index < selectedCommunicationPath.links.length && <span
                      className="communication-path-link"
                      data-medium={selectedCommunicationPath.links[index].medium}
                    >
                      <small>{selectedCommunicationPath.links[index].label}</small>
                      <i />
                    </span>}
                  </div>)}
                </div>
              </section>}
              {selectedPositioningWarning && <aside
                className="positioning-correction-warning"
                data-level={selectedPositioningWarning.level}
                role="alert"
              >
                <strong>{selectedPositioningWarning.title}</strong>
                <span>{selectedPositioningWarning.message}</span>
                <small><b>議곗튂</b>{selectedPositioningWarning.action}</small>
              </aside>}
              {selectedCommunicationProfile && <section className="communication-role-panel" aria-label="?듭떊留???븷">
                <header><small>?듭떊留?援щ텇</small><strong>{selectedCommunicationProfile.scope}</strong></header>
                <dl>
                  <div><dt>?ъ슜留?/dt><dd>{selectedCommunicationProfile.role}</dd></div>
                  <div><dt>?꾩넚?뺣낫</dt><dd>{selectedCommunicationProfile.carries}</dd></div>
                  <div><dt>?곌껐寃쎈줈</dt><dd>{selectedCommunicationProfile.path}</dd></div>
                </dl>
              </section>}
              <button type="button" onClick={() => setSelectedLocationKey(null)} aria-label="?먯궛 ?곸꽭 ?リ린">횞</button>
            </section></div>}
            {resourceDialogGroup && <div className="resource-modal-backdrop" role="presentation" onMouseDown={() => setResourceDialogGroup(null)}>
              <section className="resource-status-modal resource-modal" role="dialog" aria-modal="true" aria-label="?먯궛 ?꾪솴" onMouseDown={(event) => event.stopPropagation()}>
                <header>
                  <div>
                    <small>{resourceDialogGroup === "ALL_ASSETS" ? "?좏깮 ?ш굔??諛곗젙 ?λ퉬 ?꾪솴" : "?좏깮 ?ш굔???ㅼ떆媛?諛곗튂 ?꾪솴"}</small>
                    <strong>{resourceDialogGroup === "ALL" ? "?ъ엯 ?먯궛 諛??몄썝" : resourceDialogGroup === "ALL_ASSETS" ? "?ъ엯 ?λ퉬" : resourceGroupLabels[resourceDialogGroup]}</strong>
                  </div>
                  <b>{resourceDialogGroup === "ALL_ASSETS" ? overview.assets.length : dialogLocations.length}嫄?/b>
                  <button type="button" onClick={() => setResourceDialogGroup(null)} aria-label="?먯궛 ?꾪솴 ?リ린">횞</button>
                </header>
                {(resourceDialogGroup === "COMMUNICATION" || resourceDialogGroup === "POSITIONING" || resourceDialogGroup === "ALL") && <div className="communication-layer-guide">
                  <div><b>?꾩옣 ??띾쭩</b><strong>LPWA</strong><span>????꾩튂쨌RTCM쨌諛고꽣由?룸퉬?곸떊??/span></div>
                  <div><b>?꾩옣 怨좎냽留?/b><strong>?댁쓬5G</strong><span>?쒕줎 ?곸긽쨌?ъ쭊쨌吏?꽷룹뾽臾??곗씠??/span></div>
                  <div><b>?몃? ?곌껐留?/b><strong>LTE쨌TVWS쨌LEO</strong><span>吏?섏감?됀룻쁽?λ쭩怨??대씪?곕뱶 ?곌껐</span></div>
                </div>}
                {(resourceDialogGroup === "COMMUNICATION" || resourceDialogGroup === "POSITIONING" || resourceDialogGroup === "ALL") && <section className="communication-topology" aria-label="?듭떊留??꾩껜 ?좏뤃濡쒖?">
                  <header>
                    <div><small>?꾩껜 ?듭떊 ?좏뤃濡쒖?</small><strong>?꾩옣 ?⑤쭚 ???꾩옣留???吏?샕룻넻?좎감?????몃?留????대씪?곕뱶</strong></div>
                    <span>{topologyDataStatus}</span>
                  </header>
                  <div className="communication-topology-scroll">
                    <div className="communication-topology-grid">
                      <div className="topology-column topology-endpoints">
                        <b>?꾩옣 ?⑤쭚</b>
                        {topologyLabels.endpoints.map((label) => <span key={label}>{label}</span>)}
                      </div>
                      <div className="topology-arrow"><small>?묒냽</small><i /></div>
                      <div className="topology-column topology-field">
                        <b>?꾩옣 ?묒냽留?/b>
                        {topologyLabels.field.map((label) => <span key={label}>{label}</span>)}
                      </div>
                      <div className="topology-arrow"><small>吏묒꽑</small><i /></div>
                      <div className="topology-column topology-command">
                        <b>吏?샕룻넻?좎감??/b>
                        {topologyLabels.command.map((label) => <span key={label}>{label}</span>)}
                      </div>
                      <div className="topology-arrow"><small>諛깊?</small><i /></div>
                      <div className="topology-column topology-external">
                        <b>?몃? ?곌껐留?/b>
                        {topologyLabels.backhaul.map((label) => <span key={label}>{label}</span>)}
                      </div>
                      <div className="topology-arrow"><small>IP</small><i /></div>
                      <div className="topology-column topology-cloud">
                        <b>?대씪?곕뱶</b>
                        {topologyLabels.cloud.map((label) => <span key={label}>{label}</span>)}
                      </div>
                    </div>
                  </div>
                  <footer>
                    <span><i data-kind="field" />?꾩옣 ?대? ?듭떊</span>
                    <span><i data-kind="backhaul" />?몃? 諛깊?</span>
                    <p>LTE ?⑤쭚? ?듭떊 ?곹깭? ?댁슜 ?뺤콉???곕씪 吏?섏감?됱쓣 嫄곗튂吏 ?딄퀬 ?대씪?곕뱶濡?吏곸젒 ?곌껐?????덉뒿?덈떎. TVWS???⑤룆 ?명꽣?룸쭩???꾨땲??諛깊? 援ъ꽦???꾩슂?⑸땲??</p>
                  </footer>
                </section>}
                <div className="resource-status-list">
                  {resourceDialogGroup === "ALL_ASSETS" ? (
                    <>
                      {overview.assets.map((asset) => (
                        <button key={String(asset.assetId)} type="button">
                          <span>{assetTypeLabel(String(asset.assetType ?? "ASSET"))}</span>
                          <strong>{String(asset.assetName ?? asset.assetCode ?? asset.assetId ?? "-")}</strong>
                          <em>{korean(asset.operationalStatus ?? asset.status ?? "UNKNOWN")}</em>
                          <small>
                            {String(asset.assetCode ?? "-")}
                            {asset.modelName ? ` 쨌 ${String(asset.modelName)}` : ""}
                            {asset.mission ? ` 쨌 ${String(asset.mission)}` : ""}
                          </small>
                        </button>
                      ))}
                      {overview.assets.length === 0 && <p>?꾩옱 ?ш굔???ъ엯???λ퉬媛 ?놁뒿?덈떎.</p>}
                    </>
                  ) : (
                    <>
                      {dialogLocations.map((location) => (
                        <button
                          key={locationKey(location)}
                          type="button"
                          onClick={() => {
                            setResourceDialogGroup(null);
                            setSelectedLocationKey(locationKey(location));
                          }}
                        >
                          <span>{assetTypeLabel(location.category)}</span>
                          <strong>{location.label}</strong>
                          <em>{location.status}</em>
                          <small>
                            理쒓렐 ?듭떊 {relativeTime(location.observedAt)}
                            {location.batteryPct == null ? "" : ` 쨌 諛고꽣由?${location.batteryPct.toFixed(0)}%`}
                            {location.positioningMethod ? ` 쨌 ${korean(location.positioningMethod)}` : ""}
                            {location.horizontalAccuracyM == null ? "" : ` 쨌 짹${location.horizontalAccuracyM.toFixed(2)}m`}
                          </small>
                        </button>
                      ))}
                      {dialogLocations.length === 0 && <p>?꾩옱 ?섏떊???먯궛 ?뺣낫媛 ?놁뒿?덈떎.</p>}
                    </>
                  )}
                </div>
              </section>
            </div>}
          </section>
          <div
            className="map-status-pill"
            data-active-pulses={Object.values(changedUntil).filter((until) => until > Date.now()).length}
          ><i /> ?ш굔 ?곗씠??蹂??媛먯? 쨌 媛깆떊 二쇨린??30% ?숈븞 ?뚮몢由?媛뺤“</div>
        </section>
{(localFieldMode || localE2EMode || SHOW_VALIDATION_UI) && (displayConfig.showVideoDeck || displayConfig.showEventTimeline) && <section className="field-command-footer" aria-label="?? ?? ? ??? ????">
          {displayConfig.showVideoDeck && <div className="field-video-deck">
            <header><strong>?ㅼ떆媛??곸긽</strong><small>{fieldPreviewMode ? "誘몃━蹂닿린 4梨꾨꼸" : "RTSP ?곌껐 ?곹깭"}</small></header>
            <div>
              {[
                ["MD1000 쨌 愿묓븰", "EO"],
                ["MD1000 쨌 ?댄솕??, "IR"],
                ["吏?섏감??쨌 ?꾩옣", "CMD"],
                ["怨듭쨷 ?먯궛 쨌 蹂댁“", "AIR"],
              ].map(([label, code], index) => {
                const channel = fieldVideoChannels[index] ?? null;
                const streamUri = text(channel?.streamUri, "");
                const enabled = channel?.enabled === true;
                const verification = text(channel?.verificationStatus, "UNVERIFIED");
                const rtspReady = Boolean(streamUri) && enabled;
                const reachable = rtspReady && verification === "REACHABLE";

                const playbackState = rtspReady
                  ? fieldVideoPlaybackStates[code]
                  : undefined;

                const stateLabel = fieldPreviewMode
                  ? "DEMO"
                  : playbackState
                    ? playbackState
                    : fieldVideoLoading
                      ? "CHECK"
                      : reachable
                        ? "CONNECTING"
                        : rtspReady
                          ? "RTSP"
                          : "WAIT";

                const detailLabel = fieldPreviewMode
                  ? "DEMO 쨌 ?ㅼ젣 ?곸긽 誘몄뿰寃?
                  : playbackState === "LIVE"
                    ? "?ㅼ떆媛??곸긽 ?ъ깮 以?
                    : playbackState === "RECONNECTING"
                      ? "?곸긽 ?곌껐 蹂듦뎄 ?쒕룄 以?
                      : playbackState === "OFFLINE"
                        ? "?곸긽 ?뚯뒪 ?묐떟 ?놁쓬 쨌 ?먮룞 ?ъ뿰寃??湲?
                        : reachable
                          ? "RTSP ?뺤씤??쨌 HLS ?ъ깮 ?곌껐 以?
                          : rtspReady
                            ? "RTSP ?깅줉 쨌 ?곌껐 ?뺤씤 ?꾩슂"
                            : "?곸긽 ?뚯뒪 ?곌껐 ?湲?;

                return <article
                  key={label}
                  className={`field-video-channel field-video-channel-${index + 1}`}
                  data-preview={fieldPreviewMode ? "true" : undefined}
                  data-stream-ready={reachable ? "true" : undefined}
                  data-playback-state={playbackState}
                >
                  <div className="field-video-preview">
                    {fieldPreviewMode ? (
                      <>
                        <span className="field-video-badge">{`CH${index + 1}`}</span>
                        <span className="field-video-live">{stateLabel}</span>
                      </>
                    ) : (
                      <>
                        <VideoPlayback
                          streamUri={streamUri}
                          enabled={enabled}
                          verificationStatus={verification}
                          label={label}
                          className="field-video-playback"
                          onPlaybackStateChange={(state) => {
                            setFieldVideoPlaybackStates((previous) => {
                              if (previous[code] === state) {
                                return previous;
                              }

                              return {
                                ...previous,
                                [code]: state,
                              };
                            });
                          }}
                        />
                        <span className="field-video-badge">{`CH${index + 1}`}</span>
                        <span className="field-video-live">{stateLabel}</span>
                      </>
                    )}
                  </div>
                  <div className="field-video-caption">
                    <strong>{label}</strong>
                    <small>{detailLabel}</small>
                    <i>{code}</i>
                  </div>
                </article>;
              })}
            </div>
          </div>}
          {displayConfig.showEventTimeline && <div className="field-timeline-deck">
            <header><strong>二쇱슂 ?대깽????꾨씪??/strong><span><i data-tone="comm" />?듭떊</span><span><i data-tone="asset" />?λ퉬</span><span><i data-tone="alert" />寃쎈낫</span></header>
            <ol>
              {fieldPreviewMode && <>
                <li><time>14:25</time><i data-tone="alert" /><strong>以묎퀎湲?1??/strong><span>?좏샇 ?멸린 ???媛먯?</span></li>
                <li><time>14:22</time><i data-tone="comm" /><strong>MD1000</strong><span>?곸긽 ?꾩넚 吏??媛먯떆</span></li>
                <li><time>14:18</time><i data-tone="alert" /><strong>?꾩옣???1</strong><span>?꾩튂 ?좏샇 媛깆떊 吏??/span></li>
                <li><time>14:15</time><i data-tone="asset" /><strong>吏?섏감??/strong><span>?듭떊 ?뺤긽 蹂듦뎄</span></li>
              </>}
              {!fieldPreviewMode && liveLocations.slice(0, 4).map((location) => <li key={locationKey(location)}><time>{new Date(location.observedAt).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false })}</time><i data-tone="asset" /><strong>{location.label}</strong><span>{location.status} 쨌 理쒓렐 ?섏떊 {relativeTime(location.observedAt)}</span></li>)}
              {!fieldPreviewMode && liveLocations.length === 0 && <li className="empty"><span>?ㅺ린泥??대깽???섏떊 ?湲?/span></li>}
            </ol>
          </div>}
        </section>}
        </>
      )}
      {requirementsOpen && <RequirementsReadinessModal onClose={() => setRequirementsOpen(false)} />}

      {videoDrone && <DroneVideoModal drone={videoDrone} onClose={() => setVideoDrone(null)} />}
    </main>
  );
}

