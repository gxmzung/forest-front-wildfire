export const communicationTransports = ['LTE', '5G', 'PRIVATE_5G', 'WIFI', 'BLUETOOTH', 'LORA', 'TVWS', 'LPWA'] as const;
export const communicationLabels: Record<string, string> = { LTE: 'LTE', '5G': '5G', PRIVATE_5G: '이음5G', WIFI: 'Wi-Fi', BLUETOOTH: 'Bluetooth', LORA: 'LoRa', TVWS: 'TVWS', LPWA: 'LPWA' };
export const communicationStates: Record<string, string> = { UNTESTED: '미시험', RUNNING: '시험 중', SUCCESS: '성공', FAILURE: '실패', ERROR: '시험 오류', STALE: '결과 만료' };
export type ExistingGatewayData = {
  state: 'NOT_CONFIGURED' | 'WAITING' | 'BLOCKED' | 'ERROR' | 'STALE' | 'RECEIVED';
  observedAt?: string; deviceId?: string; controlsOutputs?: false; truncated?: boolean;
  links: { type: string; state: string; latencyMs: number | null; signalStrengthDbm: number | null; packetLossPct: number | null; throughputMbps: number | null; sampleCount: number; reportedAvailabilityPct: number | null; sourceObservedAt: string | null }[];
};
export function parseExistingGateway(value: unknown): ExistingGatewayData {
  const data = value as ExistingGatewayData;
  if (!data || !['NOT_CONFIGURED', 'WAITING', 'BLOCKED', 'ERROR', 'STALE', 'RECEIVED'].includes(data.state) || !Array.isArray(data.links) || data.links.length > 32 || (data.controlsOutputs !== undefined && data.controlsOutputs !== false)) throw Error('INVALID_GATEWAY_RESPONSE');
  if (data.observedAt !== undefined && (typeof data.observedAt !== 'string' || !Number.isFinite(Date.parse(data.observedAt)))) throw Error('INVALID_GATEWAY_RESPONSE');
  if (data.deviceId !== undefined && typeof data.deviceId !== 'string') throw Error('INVALID_GATEWAY_RESPONSE');
  for (const link of data.links) {
    if (!link || !['TVWS', 'LTE_5G', 'LEO', 'LPWA', 'ETHERNET', 'WIFI'].includes(link.type) || !['CONNECTED_REPORTED', 'DISCONNECTED_REPORTED', 'API_ERROR', 'STALE', 'UNKNOWN'].includes(link.state)) throw Error('INVALID_GATEWAY_RESPONSE');
    for (const key of ['latencyMs', 'signalStrengthDbm', 'packetLossPct', 'throughputMbps', 'reportedAvailabilityPct'] as const) if (link[key] !== null && (typeof link[key] !== 'number' || !Number.isFinite(link[key]))) throw Error('INVALID_GATEWAY_RESPONSE');
    if (!Number.isInteger(link.sampleCount) || link.sampleCount < 0 || link.sampleCount > 200 || (link.reportedAvailabilityPct !== null && (link.reportedAvailabilityPct < 0 || link.reportedAvailabilityPct > 100))) throw Error('INVALID_GATEWAY_RESPONSE');
    if (link.sourceObservedAt !== null && (typeof link.sourceObservedAt !== 'string' || !Number.isFinite(Date.parse(link.sourceObservedAt)))) throw Error('INVALID_GATEWAY_RESPONSE');
  }
  if (new Set(data.links.map((l) => l.type)).size !== data.links.length) throw Error('INVALID_GATEWAY_RESPONSE');
  return data;
}
export type CommunicationTestData = {
  tests: { transport: string; state: string; id?: string; evidence?: { latencyMs: number | null; sent: number; received: number } | null }[];
  configured: string[]; selectedRunId: string | null;
  baton: { color: string }; outputs: { relay: string; led: string };
  gateway?: ExistingGatewayData;
};
export function parseCommunicationTests(value: unknown): CommunicationTestData {
  const data = value as CommunicationTestData;
  if (!data || !Array.isArray(data.tests) || !Array.isArray(data.configured) || !data.configured.every((t) => communicationTransports.includes(t as typeof communicationTransports[number])) || !data.baton || !['GREEN', 'RED', 'OFF'].includes(data.baton.color) || !data.outputs || typeof data.outputs.relay !== 'string' || typeof data.outputs.led !== 'string') throw Error('INVALID_TEST_RESPONSE');
  if (data.tests.length !== communicationTransports.length || new Set(data.tests.map((t) => t.transport)).size !== communicationTransports.length || !data.tests.every((t) => communicationTransports.includes(t.transport as typeof communicationTransports[number]) && Object.hasOwn(communicationStates, t.state))) throw Error('INVALID_TEST_RESPONSE');
  for (const row of data.tests) {
    if (row.id !== undefined && (typeof row.id !== 'string' || !row.id)) throw Error('INVALID_TEST_RESPONSE');
    if (row.evidence && (!Number.isInteger(row.evidence.sent) || row.evidence.sent <= 0 || !Number.isInteger(row.evidence.received) || row.evidence.received < 0 || row.evidence.received > row.evidence.sent || (row.evidence.latencyMs !== null && (!Number.isFinite(row.evidence.latencyMs) || row.evidence.latencyMs < 0)))) throw Error('INVALID_TEST_RESPONSE');
  }
  if (data.selectedRunId !== null && (typeof data.selectedRunId !== 'string' || !data.tests.some((r) => r.id === data.selectedRunId))) throw Error('INVALID_TEST_RESPONSE');
  const selected = data.tests.find((r) => r.id === data.selectedRunId);
  if (data.baton.color !== (selected?.state === 'SUCCESS' ? 'GREEN' : selected?.state === 'FAILURE' ? 'RED' : 'OFF')) throw Error('INVALID_TEST_RESPONSE');
  if (data.gateway !== undefined) data.gateway = parseExistingGateway(data.gateway);
  return data;
}
