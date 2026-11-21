import { describe, expect, it } from 'vitest';
import { mapPingFailure, parsePingLatency } from '../src/utils/pingParser.js';

describe('parsePingLatency', () => {
  it('parses Windows ping output', () => {
    const output = 'Reply from 1.1.1.1: bytes=32 time=18ms TTL=57';
    expect(parsePingLatency(output)).toBe(18);
  });

  it('parses Linux ping output', () => {
    const output = '64 bytes from 1.1.1.1: icmp_seq=1 ttl=57 time=12.4 ms';
    expect(parsePingLatency(output)).toBe(12.4);
  });

  it('returns null for unsuccessful output', () => {
    expect(parsePingLatency('Request timed out')).toBeNull();
  });

  it('maps Windows timeout output to a friendly timeout', () => {
    const error = new Error('Command failed: ping.exe -n 1 -w 5000 192.168.1.104');
    expect(mapPingFailure(error, 'Request timed out.', '')).toBe('Request timed out');
  });

  it('maps unreachable and host lookup failures', () => {
    expect(mapPingFailure(null, 'Destination Host Unreachable', '')).toBe('Destination host unreachable');
    expect(mapPingFailure(null, 'Destination Net Unreachable', '')).toBe('Destination host unreachable');
    expect(mapPingFailure(null, '', 'ping: unknown host no-such-host')).toBe('Host not found');
  });

  it('maps extra Windows failure messages to ping failed', () => {
    expect(mapPingFailure(null, 'General failure.', '')).toBe('Ping failed');
    expect(mapPingFailure(null, 'Transmit failed. General failure.', '')).toBe('Ping failed');
    expect(mapPingFailure(null, 'TTL expired in transit.', '')).toBe('Ping failed');
  });

  it('uses a fallback without exposing the raw command', () => {
    const error = new Error('Command failed: ping.exe -n 1 -w 5000 192.168.1.104');
    expect(mapPingFailure(error)).toBe('Ping failed');
  });
});
