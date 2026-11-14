import { describe, it, expect } from 'vitest';
import { communicationTransports, parseCommunicationTests, parseExistingGateway } from './communicationTestData';
const sample = () => ({ tests: communicationTransports.map((transport) => ({ transport, state: 'UNTESTED' })), configured: [], selectedRunId: null, baton: { color: 'OFF' }, outputs: { relay: 'NOT_CONFIGURED', led: 'NOT_CONFIGURED' } });
describe('physical link test contract', () => {
  it('preserves untested independently of output availability', () => { expect(parseCommunicationTests(sample()).tests.every((t) => t.state === 'UNTESTED')).toBe(true); });
  it('rejects missing paths and unknown states', () => { const a = sample(); a.tests.pop(); expect(() => parseCommunicationTests(a)).toThrow(); const b = sample(); b.tests[0].state = 'UP'; expect(() => parseCommunicationTests(b)).toThrow(); });
  it('rejects duplicated paths and unknown output colors', () => { const a = sample(); a.tests[1] = a.tests[0]; expect(() => parseCommunicationTests(a)).toThrow(); const b = sample(); b.baton.color = 'OK'; expect(() => parseCommunicationTests(b)).toThrow(); });
  it('rejects green when no selected test succeeded', () => { const a = sample(); a.baton.color = 'GREEN'; expect(() => parseCommunicationTests(a)).toThrow(); });
});
describe('existing gateway evidence', () => {
  const gateway = () => ({ state: 'RECEIVED', controlsOutputs: false, links: [{ type: 'LTE_5G', state: 'CONNECTED_REPORTED', latencyMs: 0, signalStrengthDbm: null, packetLossPct: null, throughputMbps: null, sourceObservedAt: null, sampleCount: 1, reportedAvailabilityPct: 100 }] });
  it('keeps aggregate classification without changing test outcomes or baton color', () => {
    const parsed = parseCommunicationTests({ ...sample(), gateway: gateway() }); expect(parsed.gateway?.links[0].type).toBe('LTE_5G'); expect(parsed.gateway?.links[0].latencyMs).toBe(0); expect(parsed.gateway?.links[0].packetLossPct).toBeNull(); expect(parsed.tests.every((r) => r.state === 'UNTESTED')).toBe(true); expect(parsed.baton.color).toBe('OFF');
  });
  it('rejects reported states that claim to control output or split the aggregate without evidence', () => { expect(() => parseExistingGateway({ ...gateway(), controlsOutputs: true })).toThrow(); const g = gateway(); g.links[0].type = 'PRIVATE_5G'; expect(() => parseExistingGateway(g)).toThrow(); });
  it('rejects corrupt metrics and duplicate links', () => { const g = gateway(); g.links[0].latencyMs = NaN; expect(() => parseExistingGateway(g)).toThrow(); const other = gateway(); other.links.push(other.links[0]); expect(() => parseExistingGateway(other)).toThrow(); });
});
