export type VehicleWeatherTarget = { latitude: number; longitude: number };
let latest: VehicleWeatherTarget | null = null;
const listeners = new Set<(target: VehicleWeatherTarget) => void>();
export function publishVehicleWeatherTarget(target: VehicleWeatherTarget) {
  if (!Number.isFinite(target.latitude) || !Number.isFinite(target.longitude) || target.latitude < 31 || target.latitude > 44 || target.longitude < 123 || target.longitude > 133) return;
  latest = { latitude: target.latitude, longitude: target.longitude };
  for (const listener of listeners) listener({ ...latest });
}
export function subscribeVehicleWeatherTarget(listener: (target: VehicleWeatherTarget) => void) {
  listeners.add(listener); if (latest) listener({ ...latest });
  return () => { listeners.delete(listener); };
}
