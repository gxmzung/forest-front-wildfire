import { describe, expect, it } from "vitest";
import { HttpApiError } from "../../http-api/client";
import {
  classifyOperatingBootstrapFailure,
  createOperatingNoDataEvent,
  createOperatingNoDataOverview,
} from "./operatingBootstrap";

describe("operating dashboard bootstrap", () => {
  it("distinguishes a confirmed missing disaster from an API failure", () => {
    expect(classifyOperatingBootstrapFailure(new HttpApiError(404, {
      error: { code: "DISASTER_NOT_FOUND", message: "not found" },
    })).state).toBe("DISASTER_NOT_FOUND");

    expect(classifyOperatingBootstrapFailure(new TypeError("Failed to fetch"))).toEqual({
      state: "API_UNAVAILABLE",
      message: "Core API 응답을 확인할 수 없습니다. 네트워크·CORS·서버 상태를 확인해 주세요.",
    });
  });

  it("classifies an API timeout without treating it as missing data", () => {
    expect(classifyOperatingBootstrapFailure(
      new DOMException("The operation timed out", "TimeoutError"),
    )).toEqual({
      state: "API_UNAVAILABLE",
      message: "Core API 응답 시간이 초과되었습니다.",
    });
  });

  it.each(["DISASTER_NOT_FOUND", "API_UNAVAILABLE"] as const)(
    "creates an empty %s operating shell without coordinates or KPI values",
    (state) => {
      const failure = { state, message: "test state" };
      const event = createOperatingNoDataEvent("event-1", state);
      const overview = createOperatingNoDataOverview(event, failure, 0);

      expect(overview.event.eventId).toBe("event-1");
      expect(overview.assets).toEqual([]);
      expect(overview.unregisteredAssets).toEqual([]);
      expect(overview.personnel).toEqual([]);
      expect(overview.kpis).toEqual([]);
      expect(overview.domainLayers).toEqual({});
      expect(overview.liveDroneTelemetry).toMatchObject({
        status: "UNAVAILABLE",
        live: 0,
        positionUnknown: 0,
      });
      expect(overview.operatingDataStatus?.state).toBe(state);
    },
  );
});
