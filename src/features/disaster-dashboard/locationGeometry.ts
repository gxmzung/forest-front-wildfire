export type ParsedPoint = {
  longitude: number;
  latitude: number;
  altitude: number | null;
};

export function finiteTelemetryNumber(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value !== "string" || value.trim() === "") {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function parsePointGeometry(geometry: unknown): ParsedPoint | null {
  if (!geometry || typeof geometry !== "object") return null;
  const coordinates = (geometry as { coordinates?: unknown }).coordinates;
  if (!Array.isArray(coordinates)) return null;

  const longitude = finiteTelemetryNumber(coordinates[0]);
  const latitude = finiteTelemetryNumber(coordinates[1]);
  if (
    longitude === null ||
    latitude === null ||
    longitude < -180 ||
    longitude > 180 ||
    latitude < -90 ||
    latitude > 90 ||
    (longitude === 0 && latitude === 0)
  ) {
    return null;
  }

  return {
    longitude,
    latitude,
    altitude: finiteTelemetryNumber(coordinates[2]),
  };
}
