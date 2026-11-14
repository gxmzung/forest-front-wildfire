import { describe, expect, it, vi } from "vitest";
import { requestWeatherLocation } from "./weatherLocation";

const position = { coords: { latitude: 35.8, longitude: 128.1, accuracy: 80 }, timestamp: 1234 } as GeolocationPosition;
describe("weather location", () => {
  it("requests a fresh position with bounded timeout and preserves reported accuracy", async () => {
    const getCurrentPosition = vi.fn((ok: PositionCallback) => ok(position));
    await expect(requestWeatherLocation({ getCurrentPosition }, true)).resolves.toBe(position);
    expect(getCurrentPosition).toHaveBeenCalledWith(expect.any(Function), expect.any(Function), { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 });
  });
  it("does not request location in an insecure context", async () => {
    const getCurrentPosition = vi.fn();
    await expect(requestWeatherLocation({ getCurrentPosition }, false)).rejects.toThrow("HTTPS");
    expect(getCurrentPosition).not.toHaveBeenCalled();
  });
  it("reports unsupported browsers", async () => {
    await expect(requestWeatherLocation(undefined, true)).rejects.toThrow("지원하지");
  });
  it.each([[1, "권한"], [2, "확인하지"], [3, "초과"]])("reports location error %s", async (code, message) => {
    const getCurrentPosition = vi.fn((_ok: PositionCallback, fail?: PositionErrorCallback | null) => fail?.({ code } as GeolocationPositionError));
    await expect(requestWeatherLocation({ getCurrentPosition }, true)).rejects.toThrow(String(message));
  });
  it.each([NaN, 90, 0])("rejects unusable latitude %s", async (latitude) => {
    const getCurrentPosition = vi.fn((ok: PositionCallback) => ok({ ...position, coords: { ...position.coords, latitude } }));
    await expect(requestWeatherLocation({ getCurrentPosition }, true)).rejects.toThrow("유효한 위치");
  });
});
