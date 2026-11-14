import { describe, it, expect } from 'vitest';
import { communicationTransports, parseCommunicationTests } from './communicationTestData';
const sample = () => ({ tests: communicationTransports.map((transport) => ({ transport, state: 'UNTESTED' })), configured: [], selectedRunId: null, baton: { color: 'OFF' }, outputs: { relay: 'NOT_CONFIGURED', led: 'NOT_CONFIGURED' } });
describe('physical link test contract', () => {
  it('preserves untested independently of output availability', () => { expect(parseCommunicationTests(sample()).tests.every((t) => t.state === 'UNTESTED')).toBe(true); });
  it('rejects missing paths and unknown states', () => { const a = sample(); a.tests.pop(); expect(() => parseCommunicationTests(a)).toThrow(); const b = sample(); b.tests[0].state = 'UP'; expect(() => parseCommunicationTests(b)).toThrow(); });
  it('rejects duplicated paths and unknown output colors', () => { const a = sample(); a.tests[1] = a.tests[0]; expect(() => parseCommunicationTests(a)).toThrow(); const b = sample(); b.baton.color = 'OK'; expect(() => parseCommunicationTests(b)).toThrow(); });
  it('rejects green when no selected test succeeded', () => { const a = sample(); a.baton.color = 'GREEN'; expect(() => parseCommunicationTests(a)).toThrow(); });
});
