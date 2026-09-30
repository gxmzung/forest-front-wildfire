export type SlenoQualityState =
  | "LIVE"
  | "STALE"
  | "OFFLINE"
  | "WAITING";

export type SlenoDeviceQuality = {
  assetId: string;

  assetCode: string | null;
  assetName: string | null;

  vendorDeviceId: string | null;
  deviceType: string | null;

  isSimulatedDevice: boolean;

  sampleCount: number;
  counterSampleCount: number;

  latestFrameCounter: number | null;

  receivedFrames: number;
  expectedFrames: number;
  lostFrames: number;

  duplicateFrames: number;
  counterResets: number;

  frameLossPct: number | null;
  frameDeliveryPct: number | null;

  updateIntervalAvgMs: number | null;
  updateIntervalP95Ms: number | null;
  updateIntervalMaxMs: number | null;

  latestRssiDbm: number | null;
  averageRssiDbm: number | null;
  minimumRssiDbm: number | null;
  maximumRssiDbm: number | null;

  latestSnrDb: number | null;
  averageSnrDb: number | null;
  minimumSnrDb: number | null;
  maximumSnrDb: number | null;

  networkType: string | null;
  fixType: string | null;
  medium: string | null;

  lastReceivedAt: string | null;
  freshnessSec: number | null;

  state: SlenoQualityState;
};

export type SlenoNetworkQuality = {
  source: "JININFRA_VENDOR_MESSAGE";
  sourceSystem: "sleno-server";
  synthetic: false;

  calculatedAt: string;

  deviceCount: number;
  physicalDeviceCount: number;
  simulatedDeviceCount: number;

  liveCount: number;
  staleCount: number;
  offlineCount: number;

  totalReceivedFrames: number;
  totalExpectedFrames: number;
  totalLostFrames: number;

  frameLossPct: number | null;
  frameDeliveryPct: number | null;

  devices: SlenoDeviceQuality[];
};
