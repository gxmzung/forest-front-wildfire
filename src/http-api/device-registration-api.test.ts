import { describe, expect, it } from "vitest";
import {
  extractRegisteredAssetId,
  recommendedDeviceType,
  extractVendorMapping,
} from "./device-registration-api";

describe("device registration helpers", () => {
  it("extracts a direct asset_id", () => {
    expect(
      extractRegisteredAssetId({
        asset_id:
          "10000000-0000-4000-8000-000000000001",
      }),
    ).toBe(
      "10000000-0000-4000-8000-000000000001",
    );
  });

  it("extracts a nested asset id", () => {
    expect(
      extractRegisteredAssetId({
        asset: {
          asset_id:
            "20000000-0000-4000-8000-000000000002",
        },
      }),
    ).toBe(
      "20000000-0000-4000-8000-000000000002",
    );
  });

  it("extracts vendor mapping when present", () => {
    expect(
      extractVendorMapping({
        vendor_mapping: {
          vendor_code: "NDPS",
          status: "ACTIVE",
        },
      }),
    ).toMatchObject({
      vendor_code: "NDPS",
      status: "ACTIVE",
    });
  });
});

describe("device type recommendations", () => {
  it.each(["UAV", "무인 항공기", "드론"])("keeps %s as UAV", (name) => {
    expect(recommendedDeviceType("NDPS", name)).toBe("UAV");
  });
  it("preserves router and vehicle types", () => {
    expect(recommendedDeviceType("NDPS", "BACKHAUL_ROUTER")).toBe("BACKHAUL_ROUTER");
    expect(recommendedDeviceType("JININFRA", "COMMUNICATION_VEHICLE")).toBe("COMMUNICATION_VEHICLE");
  });
  it("requires explicit input for unknown types", () => {
    expect(recommendedDeviceType("NDPS", "unknown")).toBe("");
    expect(recommendedDeviceType("JININFRA", "unknown")).toBe("");
  });
});
