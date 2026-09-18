import type { ApiRecord, EventOverview, ForestEvent } from "./forest-api";

export const LOCAL_E2E_EVENT_ID = "e2e-md1000-local";

export const LOCAL_E2E_EVENT: ForestEvent = {
  eventId: LOCAL_E2E_EVENT_ID,
  eventCode: "E2E-MD1000",
  disasterType: "WILDFIRE",
  eventName: "MD1000 로컬 E2E",
  status: "RESPONDING",
  severityCode: "NORMAL",
  locationName: "LOCAL SYNTHETIC",
};

export const LOCAL_E2E_REGISTERED_ASSETS: ApiRecord[] = [
  {
    assetId: "e2e-md1000-canonical-uuid",
    assetCode: "MD1000-01",
    assetType: "UAV",
    assetName: "MD1000 E2E",
    ownerOrgCode: "LOCAL-E2E",
    modelName: "MD1000",
    serialNumber: "SYNTHETIC-NOT-AIRCRAFT",
    status: "ACTIVE",
    specifications: { synthetic: true, evidenceScope: "LOCAL_BROWSER_E2E" },
    eventResourceId: "e2e-resource-md1000",
    eventId: LOCAL_E2E_EVENT_ID,
    assignedOrgCode: "LOCAL-E2E",
    mission: "LOCAL_BROWSER_E2E",
    assignedAt: "2026-09-12T00:00:00.000Z",
    releasedAt: null,
    eventRegistrationStatus: "REGISTERED",
  },
];

export function isLocalE2EMode(): boolean {
  if (import.meta.env.VITE_LOCAL_E2E_ENABLED !== "1" || typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).get("e2e") === "1";
}

export function emptyE2EOverview(event: ForestEvent = LOCAL_E2E_EVENT): Omit<EventOverview, "assets" | "liveDroneTelemetry"> {
  return {
    event,
    unregisteredAssets: [],
    personnel: [],
    networks: [],
    topology: { networks: [], nodes: [], links: [] },
    alerts: [],
    reports: [],
    kpis: [],
    integrations: [],
    domainDetail: null,
    domainLayers: {},
  };
}
