import { describe, expect, it } from "vitest";
import { finiteTelemetryNumber, parsePointGeometry } from "./locationGeometry";

describe("finiteTelemetryNumber", () => {
  it.each([null, undefined, "", "   ", "not-a-number", Number.NaN, Number.POSITIVE_INFINITY])(
    "treats %j as missing rather than zero",
    (value) => expect(finiteTelemetryNumber(value)).toBeNull(),
  );

  it("accepts finite numeric telemetry strings", () => {
    expect(finiteTelemetryNumber("127.123")).toBe(127.123);
  });
});

describe("parsePointGeometry", () => {
  it("excludes missing and invalid positions", () => {
    expect(parsePointGeometry({ coordinates: [null, null] })).toBeNull();
    expect(parsePointGeometry({ coordinates: ["", ""] })).toBeNull();
    expect(parsePointGeometry({ coordinates: [0, 0] })).toBeNull();
    expect(parsePointGeometry({ coordinates: [181, 37] })).toBeNull();
  });

  it("keeps a valid position without inventing a missing altitude", () => {
    expect(parsePointGeometry({ coordinates: [127.1, 37.4, null] })).toEqual({
      longitude: 127.1,
      latitude: 37.4,
      altitude: null,
    });
  });
});
