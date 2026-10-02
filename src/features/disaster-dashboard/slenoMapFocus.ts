export type SlenoMapFocusLocation = {
  category: string;
  sourceSystem: string;
  longitude: number;
  latitude: number;
  observedAt?: string | null;
};

export function pickSlenoRtkFocusCenter(
  locations: SlenoMapFocusLocation[],
): [number, number] | null {
  const candidates = locations.filter((location) =>
    location.category === "RTK_TERMINAL" &&
    location.sourceSystem === "sleno-server" &&
    Number.isFinite(location.longitude) &&
    Number.isFinite(location.latitude) &&
    !(location.longitude === 0 && location.latitude === 0)
  );

  if (candidates.length === 0) {
    return null;
  }

  const latest = [...candidates].sort((a, b) => {
    const aTime = Date.parse(String(a.observedAt ?? "")) || 0;
    const bTime = Date.parse(String(b.observedAt ?? "")) || 0;
    return bTime - aTime;
  })[0];

  return latest
    ? [latest.longitude, latest.latitude]
    : null;
}
