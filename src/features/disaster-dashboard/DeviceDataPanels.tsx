import { useEffect, useState } from "react";
import type { LiveLocation } from "./UnifiedDisasterDashboard";
import { calculatePacketSequence, distanceMeters, type TelemetrySample } from "./operationalEvidence";
import { kstTime } from "./weatherTicker";
import "./kma-weather.css";

export function validDeviceSample(sample: TelemetrySample) {
  return typeof sample.latitude === "number" && Number.isFinite(sample.latitude) && sample.latitude >= -90 && sample.latitude <= 90 && typeof sample.longitude === "number" && Number.isFinite(sample.longitude) && sample.longitude >= -180 && sample.longitude <= 180 && Number.isFinite(Date.parse(sample.observedAt)) && Number.isFinite(Date.parse(sample.receivedAt));
}
export function displacementFromReference(reference: { assetId: string; latitude: number; longitude: number } | null, sample: TelemetrySample | undefined) {
  if (!reference || !sample || reference.assetId !== sample.assetId || !validDeviceSample(sample)) return null;
  return distanceMeters([reference.longitude, reference.latitude], [sample.longitude!, sample.latitude!]);
}
const metric = (raw: number | null | undefined, unit: string) => typeof raw === "number" && Number.isFinite(raw) && raw >= 0 ? `${raw.toLocaleString("ko-KR", { maximumFractionDigits: 2 })}${unit}` : "미수신";

export function PositionDataPanel({ locations, samples }: { locations: LiveLocation[]; samples: TelemetrySample[] }) {
  const [selectedId, setSelectedId] = useState("");
  const [reference, setReference] = useState<{ assetId: string; latitude: number; longitude: number } | null>(null);
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(timer); }, []);
  const latest = new Map<string, TelemetrySample>();
  for (const sample of samples) if (validDeviceSample(sample) && (!latest.has(sample.assetId) || Date.parse(sample.observedAt) > Date.parse(latest.get(sample.assetId)!.observedAt))) latest.set(sample.assetId, sample);
  const id = latest.has(selectedId) ? selectedId : latest.keys().next().value as string | undefined;
  const sample = id ? latest.get(id) : undefined;
  const location = id ? locations.find((row) => row.id === id || row.sourceAssetId === id) : undefined;
  const age = sample ? now - Date.parse(sample.observedAt) : Infinity;
  const receivedAge = sample ? now - Date.parse(sample.receivedAt) : Infinity;
  const fresh = age >= -5000 && age <= 15_000 && receivedAge >= -5000 && receivedAge <= 15_000;
  const sameObservation = Boolean(location && sample && Date.parse(location.observedAt) === Date.parse(sample.observedAt));
  const displacement = displacementFromReference(reference, sample);
  return <section className="environment-data-panel" aria-label="장비 위치 데이터">
    <header><strong>GNSS·장비 위치</strong><span>{sample ? fresh ? "수신 중" : "마지막 수신값" : "장비 수신 대기"}</span></header>
    <p>실제 관제 텔레메트리 수신값 · 브라우저 위치와 구분</p>
    <label>장비<select value={id ?? ""} onChange={(event) => setSelectedId(event.target.value)}><option value="">장비 선택</option>{[...latest.keys()].map((assetId) => <option key={assetId} value={assetId}>{locations.find((row) => row.id === assetId)?.label ?? assetId}</option>)}</select></label>
    <dl>
      <div><dt>위도</dt><dd>{sample?.latitude?.toFixed(7) ?? "미수신"}</dd></div><div><dt>경도</dt><dd>{sample?.longitude?.toFixed(7) ?? "미수신"}</dd></div>
      <div><dt>보고 이동속도</dt><dd>{metric(sameObservation ? location?.groundSpeedMps : null, "m/s")}</dd></div><div><dt>기준점 대비 직선 이동량</dt><dd>{displacement === null ? "기준점 미설정" : metric(displacement, "m")}</dd></div>
      <div><dt>측위 방식</dt><dd>{sameObservation ? location?.positioningMethod || "미수신" : "미수신"}</dd></div><div><dt>보고 수평 정확도</dt><dd>{metric(sameObservation ? location?.horizontalAccuracyM : null, "m")}</dd></div>
    </dl>
    <div className="data-actions"><button type="button" disabled={!sample || !fresh} onClick={() => { if (sample) setReference({ assetId: sample.assetId, latitude: sample.latitude!, longitude: sample.longitude! }); }}>현재 장비 위치를 기준점으로 설정</button><button type="button" disabled={!reference} onClick={() => setReference(null)}>기준점 해제</button></div>
    <p>측정 시각: {sample ? kstTime(sample.observedAt) + " KST" : "미수신"}</p>
    <p>수신 시각: {sample ? kstTime(sample.receivedAt) + " KST" : "미수신"}</p>
    {!fresh && sample && <p className="data-warning">최근 15초 내 새 측정값이 없습니다. 현재 위치로 단정하지 않습니다.</p>}
    <p>이동량은 기준점과 마지막 측정점 사이 직선거리입니다. 누적 이동거리가 아니며 GNSS 오차가 포함됩니다.</p>
  </section>;
}

export function NetworkDataSummary({ locations, samples }: { locations: LiveLocation[]; samples: TelemetrySample[] }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(timer); }, []);
  const [selectedId, setSelectedId] = useState("");
  const ids = [...new Set(samples.map((row) => row.assetId).filter(Boolean))];
  const id = ids.includes(selectedId) ? selectedId : ids[0];
  const packets = id ? calculatePacketSequence(samples, id, 100) : null;
  const location = id ? locations.find((row) => row.id === id || row.sourceAssetId === id) : undefined;
  const received = id ? [...samples].filter((row) => row.assetId === id).sort((a, b) => Date.parse(b.receivedAt) - Date.parse(a.receivedAt))[0] : undefined;
  const matching = Boolean(location && received && Date.parse(location.observedAt) === Date.parse(received.observedAt));
  const receptionGap = received && Number.isFinite(Date.parse(received.receivedAt)) ? Math.max(0, (now - Date.parse(received.receivedAt)) / 1000) : null;
  return <section className="environment-data-panel" aria-label="장비 통신 수신 데이터">
    <header><strong>장비 통신 데이터</strong><span>{receptionGap === null ? "미수신" : receptionGap > 15 ? "갱신 지연" : "최근 수신"}</span></header>
    <label>장비<select value={id ?? ""} onChange={(event) => setSelectedId(event.target.value)}><option value="">장비 선택</option>{ids.map((key) => <option key={key} value={key}>{locations.find((row) => row.id === key)?.label ?? key}</option>)}</select></label>
    <dl><div><dt>보고 통신 경로</dt><dd>{matching ? location?.networkMode || location?.pathEvidence?.transport || "미수신" : "미수신"}</dd></div><div><dt>장비 보고 지연</dt><dd>{metric(matching ? location?.latencyMs : null, "ms")}</dd></div><div><dt>최근 SEQ 수신율</dt><dd>{metric(packets?.successPct, "%")}</dd></div><div><dt>최근 SEQ 누락률</dt><dd>{metric(packets?.lossPct, "%")}</dd></div></dl>
    <p>마지막 수신 후 경과: {metric(receptionGap, "초")}</p>
    <p>최종 수신: {received && Number.isFinite(Date.parse(received.receivedAt)) ? kstTime(received.receivedAt) + " KST" : "미수신"}</p>
    <p>장비별 최근 최대 100개 SEQ 구간 기준입니다. LTE·Wi‑Fi 각각의 성공/실패는 해당 경로의 실측 증거가 있을 때 판정합니다. 미시험을 실패로 표시하지 않습니다.</p>
  </section>;
}
