import React, { useMemo, useState } from "react";

type Health = "normal" | "warning" | "critical";
type AssetType = "drone" | "relay" | "crew" | "vehicle";

type KpiItem = {
  label: string;
  value: string;
  unit?: string;
  health: Health;
  note: string;
};

type AssetItem = {
  id: string;
  name: string;
  type: AssetType;
  enabled: boolean;
  health: Health;
  meta: string;
};

type EventItem = {
  id: string;
  time: string;
  title: string;
  detail: string;
  health: Health;
};

type NetworkItem = {
  id: string;
  name: string;
  loss: number;
  rsrp: number;
  latency: number;
  health: Health;
  status: string;
};

type MarkerItem = {
  id: string;
  name: string;
  type: AssetType;
  x: number;
  y: number;
  health: Health;
  meta: string;
};

const HEALTH = {
  normal: {
    text: "text-emerald-400",
    border: "border-emerald-500/30",
    bg: "bg-emerald-500/10",
    dot: "bg-emerald-400",
    ring: "ring-emerald-500/20",
  },
  warning: {
    text: "text-yellow-300",
    border: "border-yellow-500/30",
    bg: "bg-yellow-500/10",
    dot: "bg-yellow-400",
    ring: "ring-yellow-500/20",
  },
  critical: {
    text: "text-red-400",
    border: "border-red-500/30",
    bg: "bg-red-500/10",
    dot: "bg-red-500",
    ring: "ring-red-500/20",
  },
} as const;

const KPI_DATA: KpiItem[] = [
  { label: "시스템 가동률", value: "99.98", unit: "%", health: "normal", note: "최근 24시간" },
  { label: "위치 갱신 지연", value: "1.4", unit: "s", health: "normal", note: "GPS → Core" },
  { label: "정보공유 성공률", value: "99.0", unit: "%", health: "normal", note: "목표 ≥98%" },
  { label: "패킷 손실", value: "4.0", unit: "%", health: "warning", note: "MD1000 uplink" },
  { label: "활성 장비", value: "28", unit: "/32", health: "normal", note: "4대 대기" },
  { label: "미확인 경보", value: "2", health: "critical", note: "즉시 확인 필요" },
];

const INITIAL_ASSETS: AssetItem[] = [
  { id: "asset-drone", name: "MD1000 무인기", type: "drone", enabled: true, health: "warning", meta: "SYS 1 / COMP 1" },
  { id: "asset-relay-1", name: "산악 중계기 1호", type: "relay", enabled: true, health: "normal", meta: "Loss 0.7%" },
  { id: "asset-relay-2", name: "산악 중계기 2호", type: "relay", enabled: true, health: "normal", meta: "Loss 0.9%" },
  { id: "asset-relay-3", name: "산악 중계기 3호", type: "relay", enabled: true, health: "critical", meta: "Loss 12.0%" },
  { id: "asset-crew", name: "현장 대원", type: "crew", enabled: true, health: "normal", meta: "12명" },
  { id: "asset-vehicle", name: "지휘차량", type: "vehicle", enabled: true, health: "normal", meta: "현장지휘" },
];

const EVENTS: EventItem[] = [
  { id: "evt-1", time: "17:42:35", title: "MD1000 텔레메트리 갱신", detail: "GLOBAL_POSITION_INT(33) 정상 수신", health: "normal" },
  { id: "evt-2", time: "17:42:31", title: "중계기 3호 패킷 손실", detail: "최근 100 SEQ 기준 12.0%", health: "critical" },
  { id: "evt-3", time: "17:42:20", title: "CREW-04 위치 갱신 지연", detail: "마지막 수신 8.4초 전", health: "warning" },
  { id: "evt-4", time: "17:42:12", title: "EO 스트림 연결", detail: "MD1000 광학 영상 정상", health: "normal" },
];

const NETWORKS: NetworkItem[] = [
  { id: "net-1", name: "중계기 3호", loss: 12, rsrp: -104, latency: 92, health: "critical", status: "DEGRADED" },
  { id: "net-2", name: "CREW-04", loss: 100, rsrp: -122, latency: 0, health: "critical", status: "OFFLINE" },
  { id: "net-3", name: "MD1000", loss: 4, rsrp: -92, latency: 42, health: "warning", status: "CAUTION" },
  { id: "net-4", name: "중계기 1호", loss: 0.7, rsrp: -78, latency: 18, health: "normal", status: "ONLINE" },
];

const MARKERS: MarkerItem[] = [
  { id: "marker-drone", name: "MD1000", type: "drone", x: 57, y: 34, health: "warning", meta: "ALT 113m" },
  { id: "marker-relay1", name: "중계기 1호", type: "relay", x: 31, y: 49, health: "normal", meta: "정상" },
  { id: "marker-relay2", name: "중계기 2호", type: "relay", x: 74, y: 56, health: "normal", meta: "정상" },
  { id: "marker-relay3", name: "중계기 3호", type: "relay", x: 64, y: 26, health: "critical", meta: "신호 약화" },
  { id: "marker-vehicle", name: "지휘차량", type: "vehicle", x: 49, y: 67, health: "normal", meta: "현장 지휘" },
  { id: "marker-crew", name: "CREW-01", type: "crew", x: 43, y: 59, health: "normal", meta: "이동 중" },
];

function StatusBadge({ health, text }: { health: Health; text: string }) {
  const h = HEALTH[health];

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[10px] font-bold ${h.border} ${h.bg} ${h.text}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${h.dot}`} />
      {text}
    </span>
  );
}

function KpiCard({ item }: { item: KpiItem }) {
  const h = HEALTH[item.health];

  return (
    <article className="relative min-w-0 overflow-hidden rounded-xl border border-slate-800 bg-slate-900/80 px-4 py-3 shadow-[0_10px_30px_rgba(0,0,0,0.18)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[11px] font-semibold uppercase tracking-[0.13em] text-slate-400">
            {item.label}
          </p>

          <div className="mt-2 flex items-end gap-1.5">
            <strong className={`font-mono text-3xl font-black leading-none ${h.text}`}>
              {item.value}
            </strong>

            {item.unit && (
              <span className="mb-0.5 text-xs font-semibold text-slate-500">
                {item.unit}
              </span>
            )}
          </div>
        </div>

        <StatusBadge
          health={item.health}
          text={
            item.health === "normal"
              ? "정상"
              : item.health === "warning"
                ? "주의"
                : "장애"
          }
        />
      </div>

      <p className="mt-2 truncate text-[10px] text-slate-600">
        {item.note}
      </p>
    </article>
  );
}

function AssetIcon({ type }: { type: AssetType }) {
  const icon =
    type === "drone"
      ? "✦"
      : type === "relay"
        ? "⌁"
        : type === "vehicle"
          ? "▰"
          : "●";

  return (
    <span className="grid h-7 w-7 place-items-center rounded-md border border-slate-700 bg-slate-950 text-xs font-black text-cyan-300">
      {icon}
    </span>
  );
}

function AssetPanel() {
  const [assets, setAssets] = useState(INITIAL_ASSETS);

  const toggle = (id: string) => {
    setAssets((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, enabled: !item.enabled } : item,
      ),
    );
  };

  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-slate-800 bg-slate-900/75">
      <header className="flex items-center justify-between border-b border-slate-800 px-3 py-2.5">
        <div>
          <h2 className="text-xs font-bold text-slate-100">현장 자산 체크리스트</h2>
          <p className="mt-0.5 text-[9px] text-slate-500">표시 / 통신 상태</p>
        </div>
        <span className="font-mono text-[9px] text-cyan-400">{assets.length} ASSET</span>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        <div className="space-y-1.5">
          {assets.map((asset) => {
            const h = HEALTH[asset.health];

            return (
              <label
                key={asset.id}
                className={`flex cursor-pointer items-center justify-between gap-2 rounded-lg border px-2.5 py-2 ${
                  asset.enabled
                    ? "border-slate-700 bg-slate-950/60"
                    : "border-slate-800 bg-slate-950/30 opacity-50"
                }`}
              >
                <div className="flex min-w-0 items-center gap-2">
                  <input
                    type="checkbox"
                    checked={asset.enabled}
                    onChange={() => toggle(asset.id)}
                    className="h-4 w-4 shrink-0 accent-cyan-400"
                  />
                  <AssetIcon type={asset.type} />
                  <div className="min-w-0">
                    <p className="truncate text-[11px] font-semibold text-slate-200">
                      {asset.name}
                    </p>
                    <p className="truncate text-[9px] text-slate-500">
                      {asset.meta}
                    </p>
                  </div>
                </div>

                <span className={`h-2.5 w-2.5 shrink-0 rounded-full ring-4 ${h.dot} ${h.ring}`} />
              </label>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function IncidentSummary() {
  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900/75 p-3">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
            Active Incident
          </p>
          <h2 className="mt-1 text-sm font-black text-slate-100">
            산불 · 산악 중계기 2호 인근
          </h2>
        </div>
        <StatusBadge health="critical" text="심각" />
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-[10px]">
        <div>
          <dt className="text-slate-600">발생 시각</dt>
          <dd className="mt-0.5 font-semibold text-slate-300">11:23</dd>
        </div>
        <div>
          <dt className="text-slate-600">추정 규모</dt>
          <dd className="mt-0.5 font-semibold text-slate-300">약 52 ha</dd>
        </div>
        <div>
          <dt className="text-slate-600">상태</dt>
          <dd className="mt-0.5 font-semibold text-red-400">확산 중</dd>
        </div>
        <div>
          <dt className="text-slate-600">대응 단계</dt>
          <dd className="mt-0.5 font-semibold text-yellow-300">산불 3단계</dd>
        </div>
      </dl>
    </section>
  );
}

function TimelinePanel() {
  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-slate-800 bg-slate-900/75">
      <header className="flex items-center justify-between border-b border-slate-800 px-3 py-2.5">
        <div>
          <h2 className="text-xs font-bold text-slate-100">실시간 이벤트</h2>
          <p className="mt-0.5 text-[9px] text-slate-500">최신 이벤트 우선</p>
        </div>
        <span className="font-mono text-[9px] text-slate-600">{EVENTS.length}</span>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2">
        {EVENTS.map((event, index) => {
          const h = HEALTH[event.health];

          return (
            <div key={event.id} className="grid grid-cols-[52px_12px_1fr] gap-2 pb-4">
              <time className="font-mono text-[9px] text-slate-600">{event.time}</time>

              <div className="relative flex justify-center">
                {index < EVENTS.length - 1 && (
                  <span className="absolute top-2 h-[calc(100%+6px)] w-px bg-slate-800" />
                )}
                <span className={`relative z-10 mt-0.5 h-2 w-2 rounded-full ${h.dot}`} />
              </div>

              <div className="min-w-0">
                <p className={`truncate text-[10px] font-bold ${h.text}`}>{event.title}</p>
                <p className="mt-0.5 text-[9px] leading-relaxed text-slate-500">{event.detail}</p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function MapMarker({ marker }: { marker: MarkerItem }) {
  const h = HEALTH[marker.health];

  return (
    <div
      className="group absolute z-20 -translate-x-1/2 -translate-y-1/2"
      style={{ left: `${marker.x}%`, top: `${marker.y}%` }}
    >
      <button
        type="button"
        className={`grid h-8 w-8 place-items-center rounded-lg border bg-slate-950/95 font-black shadow-[0_0_20px_rgba(14,165,233,0.18)] ${h.border} ${h.text}`}
      >
        {marker.type === "drone"
          ? "✦"
          : marker.type === "relay"
            ? "⌁"
            : marker.type === "vehicle"
              ? "▰"
              : "●"}
      </button>

      <div className="pointer-events-none absolute left-1/2 top-full z-50 mt-2 hidden w-max max-w-[180px] -translate-x-1/2 rounded-lg border border-slate-700 bg-slate-950/95 px-3 py-2 shadow-xl backdrop-blur-md group-hover:block">
        <p className="text-[10px] font-bold text-slate-100">{marker.name}</p>
        <p className="mt-0.5 text-[9px] text-slate-500">{marker.meta}</p>
      </div>
    </div>
  );
}

function TacticalMap() {
  return (
    <section className="relative h-full min-h-0 overflow-hidden rounded-xl border border-slate-800 bg-slate-950 shadow-[inset_0_0_70px_rgba(14,165,233,0.05)]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(14,165,233,0.08),transparent_55%)]" />

      <div
        className="absolute inset-0 opacity-[0.20]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(59,130,246,.16) 1px, transparent 1px), linear-gradient(90deg, rgba(59,130,246,.16) 1px, transparent 1px)",
          backgroundSize: "36px 36px",
        }}
      />

      <div className="absolute left-[18%] top-[24%] h-44 w-72 rotate-6 rounded-[50%] border border-red-500/40 bg-red-500/10" />

      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 1000 700" preserveAspectRatio="none">
        <path
          d="M120 560 C 260 410, 380 500, 470 360 S 720 250, 900 190"
          fill="none"
          stroke="rgba(16,185,129,.58)"
          strokeWidth="2"
          strokeDasharray="10 7"
        />
        <path
          d="M250 170 C 380 240, 470 230, 560 300 S 710 420, 840 510"
          fill="none"
          stroke="rgba(234,179,8,.50)"
          strokeWidth="2"
          strokeDasharray="7 8"
        />
      </svg>

      {MARKERS.map((marker) => (
        <MapMarker key={marker.id} marker={marker} />
      ))}

      <div className="absolute left-3 top-3 z-30 rounded-lg border border-cyan-500/30 bg-slate-900/80 px-3 py-2 backdrop-blur-md">
        <p className="text-[8px] uppercase tracking-[0.16em] text-cyan-400">Tactical Area</p>
        <p className="mt-0.5 text-xs font-bold text-slate-100">산악 대응구역 A-01</p>
      </div>

      <div className="absolute right-3 top-3 z-30 flex overflow-hidden rounded-lg border border-slate-700 bg-slate-900/80 backdrop-blur-md">
        <button className="bg-cyan-500/15 px-3 py-2 text-[10px] font-bold text-cyan-300">3D MAP</button>
        <button className="border-l border-slate-700 px-3 py-2 text-[10px] text-slate-400">2D</button>
        <button className="border-l border-slate-700 px-3 py-2 text-[10px] text-slate-400">SAT</button>
      </div>

      <div className="absolute bottom-3 left-3 right-3 z-30 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 rounded-lg border border-cyan-500/20 bg-slate-900/80 px-3 py-2 backdrop-blur-md">
          <button className="grid h-7 w-7 place-items-center rounded-md border border-slate-700 bg-slate-950 text-cyan-300">
            ▶
          </button>

          <div className="h-1.5 w-40 overflow-hidden rounded-full bg-slate-800">
            <div className="h-full w-[42%] bg-cyan-400" />
          </div>

          <span className="font-mono text-[9px] text-slate-400">17:42:35</span>
        </div>

        <div className="flex items-center gap-3 rounded-lg border border-emerald-500/20 bg-slate-900/80 px-3 py-2 backdrop-blur-md">
          <span className="inline-flex items-center gap-1 text-[9px] text-slate-400">
            <span className="h-2 w-2 rounded-full bg-emerald-400" /> 정상
          </span>
          <span className="inline-flex items-center gap-1 text-[9px] text-slate-400">
            <span className="h-2 w-2 rounded-full bg-yellow-400" /> 주의
          </span>
          <span className="inline-flex items-center gap-1 text-[9px] text-slate-400">
            <span className="h-2 w-2 rounded-full bg-red-500" /> 위험
          </span>
        </div>
      </div>
    </section>
  );
}

function SelectedAssetPanel() {
  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900/75 p-3">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[9px] uppercase tracking-[0.14em] text-slate-500">Selected Asset</p>
          <h2 className="mt-1 text-base font-black text-slate-100">MD1000</h2>
          <p className="mt-0.5 text-[9px] text-slate-500">UAV · SYS 1 / COMP 1</p>
        </div>
        <StatusBadge health="warning" text="주의" />
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-2">
          <p className="text-[8px] text-slate-600">GPS</p>
          <p className="mt-1 text-sm font-black text-emerald-400">3D FIX</p>
        </div>
        <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-2">
          <p className="text-[8px] text-slate-600">ALT</p>
          <p className="mt-1 text-sm font-black text-cyan-300">113m</p>
        </div>
        <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-2">
          <p className="text-[8px] text-slate-600">BAT</p>
          <p className="mt-1 text-sm font-black text-yellow-300">78%</p>
        </div>
      </div>
    </section>
  );
}

function NetworkPanel() {
  const rank: Record<Health, number> = {
    critical: 3,
    warning: 2,
    normal: 1,
  };

  const sorted = useMemo(
    () => [...NETWORKS].sort((a, b) => rank[b.health] - rank[a.health] || b.loss - a.loss),
    [],
  );

  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-slate-800 bg-slate-900/75">
      <header className="flex items-center justify-between border-b border-slate-800 px-3 py-2.5">
        <div>
          <h2 className="text-xs font-bold text-slate-100">네트워크 장애 우선순위</h2>
          <p className="mt-0.5 text-[9px] text-slate-500">위험도 기준 자동 정렬</p>
        </div>
        <StatusBadge health="critical" text="2 CRITICAL" />
      </header>

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-2.5">
        {sorted.map((item) => {
          const h = HEALTH[item.health];

          return (
            <article key={item.id} className={`rounded-lg border p-3 ${h.border} ${h.bg}`}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className={`text-[11px] font-bold ${h.text}`}>{item.name}</p>
                  <p className="mt-0.5 text-[8px] uppercase tracking-[0.12em] text-slate-600">{item.status}</p>
                </div>
                <span className={`h-2.5 w-2.5 rounded-full ${h.dot}`} />
              </div>

              <div className="mt-3 grid grid-cols-3 gap-2">
                <div className="rounded-md border border-slate-800 bg-slate-950/60 p-2">
                  <p className="text-[7px] text-slate-600">LOSS</p>
                  <p className="mt-1 font-mono text-sm font-black text-red-400">{item.loss}%</p>
                </div>
                <div className="rounded-md border border-slate-800 bg-slate-950/60 p-2">
                  <p className="text-[7px] text-slate-600">RSRP</p>
                  <p className="mt-1 font-mono text-sm font-black text-slate-200">{item.rsrp}</p>
                </div>
                <div className="rounded-md border border-slate-800 bg-slate-950/60 p-2">
                  <p className="text-[7px] text-slate-600">LAT</p>
                  <p className="mt-1 font-mono text-sm font-black text-slate-200">{item.latency}ms</p>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function TopHeader() {
  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-slate-800 bg-slate-950 px-4">
      <div className="flex min-w-0 items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-lg border border-cyan-400/30 bg-cyan-500/10 text-sm font-black text-cyan-300">
          산
        </div>

        <div className="min-w-0">
          <h1 className="truncate text-sm font-black text-slate-100">
            산림 현장통신 통합상황판
          </h1>
          <p className="truncate text-[9px] uppercase tracking-[0.18em] text-slate-600">
            Forest Disaster Tactical Communication Center
          </p>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="text-right">
          <p className="font-mono text-sm font-black text-slate-100">17:42:36</p>
          <p className="text-[8px] text-slate-600">2026.09.12</p>
        </div>
        <StatusBadge health="normal" text="실시간 감시" />
      </div>
    </header>
  );
}

export default function FieldTacticalDashboard() {
  return (
    <div className="h-screen w-screen overflow-hidden bg-slate-950 text-slate-200">
      <div className="flex h-full w-full flex-col">
        <TopHeader />

        <section className="shrink-0 border-b border-slate-800 bg-slate-950/95 px-3 py-3">
          <div className="grid grid-cols-6 gap-2">
            {KPI_DATA.map((item) => (
              <KpiCard key={item.label} item={item} />
            ))}
          </div>
        </section>

        <main className="grid min-h-0 flex-1 grid-cols-12 gap-3 bg-slate-950 p-3">
          <aside className="col-span-3 flex min-h-0 flex-col gap-3">
            <IncidentSummary />
            <AssetPanel />
            <TimelinePanel />
          </aside>

          <section className="col-span-6 min-h-0">
            <TacticalMap />
          </section>

          <aside className="col-span-3 flex min-h-0 flex-col gap-3">
            <SelectedAssetPanel />
            <NetworkPanel />
          </aside>
        </main>
      </div>
    </div>
  );
}
