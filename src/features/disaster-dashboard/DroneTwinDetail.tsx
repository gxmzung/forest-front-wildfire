import type { ApiRecord } from "../../http-api";
import { twinState } from "../../http-api/live-drone-twin";

const value = (input: unknown, unit = "") => typeof input === "number" && Number.isFinite(input) ? `${input.toFixed(1)}${unit}` : "수신 전";
export function DroneTwinDetail({asset}: {asset: ApiRecord}) {
  const attrs = (asset.attributes ?? {}) as ApiRecord;
  if (asset.sourceSystem !== "GCS_UPLINK") return null;
  const state = twinState(asset.observedAt,asset.receivedAt);
  return <>
    <div><dt>위치 동기화</dt><dd><strong data-twin-state={state}>{state}</strong> · {state === "LIVE" ? "최근 위치 수신" : "마지막 위치 · 현재 위치 확인 필요"}</dd></div>
    <div><dt>최종 위치 시각</dt><dd>{String(asset.observedAt ?? "수신 전")}</dd></div>
    <div><dt>Core 접수 시각</dt><dd>{String(asset.receivedAt ?? "수신 전")}</dd></div>
    <div><dt>GPS Fix / 위성</dt><dd>{attrs.gpsFixType == null ? "수신 전" : `Fix ${attrs.gpsFixType}`} / {String(attrs.satellitesVisible ?? "수신 전")}</dd></div>
    <div><dt>측위 / 수평 정확도</dt><dd>{String(asset.positioningMethod ?? "수신 전")} / {value(asset.horizontalAccuracyM,"m")}</dd></div>
    <div><dt>상대 고도 / 전압</dt><dd>{value(attrs.relativeAltitudeM,"m")} / {value(attrs.batteryVoltageV,"V")}</dd></div>
    <div><dt>Roll / Pitch / Yaw</dt><dd>{value(attrs.rollDeg,"°")} / {value(attrs.pitchDeg,"°")} / {value(attrs.yawDeg,"°")}</dd></div>
    <div><dt>위치 원천</dt><dd>GLOBAL_POSITION_INT (33)</dd></div>
    <div><dt>MAVLink</dt><dd>{attrs.mavlinkVersion == null ? "수신 전" : `v${attrs.mavlinkVersion}`} · {attrs.mavlinkSigned === true ? (attrs.mavlinkSignatureVerified === true ? "서명 검증됨" : "서명 존재 · 미검증") : "미서명"}</dd></div>
    <div><dt>System / Component</dt><dd>{String(attrs.systemId ?? "수신 전")} / {String(attrs.componentId ?? "수신 전")}</dd></div>
    <div><dt>지상 / 수직 속도</dt><dd>{value(attrs.groundSpeedMps,"m/s")} / {value(attrs.verticalSpeedMps,"m/s")}</dd></div>
    <div><dt>수신 소스</dt><dd>{String(attrs.sourceAddress ?? "수신 전")}</dd></div>
    <div><dt>물리 / Canonical ID</dt><dd>{String(asset.sourceAssetId)} / {String(asset.assetId)}</dd></div>
  </>;
}

import "./drone-twin.css";
