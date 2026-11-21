import { describe, expect, it } from 'vitest';
import { isValidHostname, isValidHttpUrl, validateMonitorInput } from '../src/middleware/validation.js';

describe('monitor validators', () => {
  it('accepts hostnames and rejects shell characters', () => {
    expect(isValidHostname('1.1.1.1')).toBe(true);
    expect(isValidHostname('example.com')).toBe(true);
    expect(isValidHostname('1.1.1.1; calc')).toBe(false);
    expect(isValidHostname('server|pipe')).toBe(false);
  });

  it('accepts only HTTP and HTTPS URLs', () => {
    expect(isValidHttpUrl('https://example.com')).toBe(true);
    expect(isValidHttpUrl('ftp://example.com')).toBe(false);
    expect(isValidHttpUrl('https://example.com/test;rm')).toBe(false);
  });

  it('validates TCP and HTTP-specific fields', () => {
    expect(validateMonitorInput({
      name: 'Web', type: 'http', target: 'https://example.com'
    })).toEqual([]);
    expect(validateMonitorInput({
      name: 'Bad TCP', type: 'tcp', target: 'localhost'
    })).toContain('port is required for tcp monitors');
  });
});
