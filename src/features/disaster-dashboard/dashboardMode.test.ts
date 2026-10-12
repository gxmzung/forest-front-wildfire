import { describe, expect, it } from "vitest";
import { isExplicitDashboardDemo } from "./dashboardMode";

describe("dashboard mode", () => {
  it("keeps the default operating route out of DEMO mode", () => {
    expect(isExplicitDashboardDemo("")).toBe(false);
    expect(isExplicitDashboardDemo("?live=1")).toBe(false);
    expect(isExplicitDashboardDemo("?field=1&preview=1")).toBe(false);
  });

  it("enables DEMO data only through an explicit flag", () => {
    expect(isExplicitDashboardDemo("?demo=1")).toBe(true);
    expect(isExplicitDashboardDemo("?demo=1&scenario=WILDFIRE")).toBe(true);
    expect(isExplicitDashboardDemo("?demo=0")).toBe(false);
  });
});
