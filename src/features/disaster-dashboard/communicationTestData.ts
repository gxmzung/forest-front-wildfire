export const communicationTransports = ['LTE', '5G', 'PRIVATE_5G', 'WIFI', 'BLUETOOTH', 'LORA', 'TVWS', 'LPWA'] as const;
export const communicationLabels: Record<string, string> = { LTE: 'LTE', '5G': '5G', PRIVATE_5G: '이음5G', WIFI: 'Wi-Fi', BLUETOOTH: 'Bluetooth', LORA: 'LoRa', TVWS: 'TVWS', LPWA: 'LPWA' };
export const communicationStates: Record<string, string> = { UNTESTED: '미시험', RUNNING: '시험 중', SUCCESS: '성공', FAILURE: '실패', ERROR: '시험 오류', STALE: '결과 만료' };
export type CommunicationTestData = {
  tests: { transport: string; state: string; id?: string; evidence?: { latencyMs: number | null; sent: number; received: number } | null }[];
  configured: string[]; selectedRunId: string | null;
  baton: { color: string }; outputs: { relay: string; led: string };
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
  return data;
}
