import { describe, expect, it } from 'vitest';
import {
  JWT_SECRET_PLACEHOLDER,
  parseRequireAuthForRead,
  validateJwtSecret
} from '../src/config.js';

describe('JWT secret validation', () => {
  it('rejects missing production secrets', () => {
    expect(() => validateJwtSecret('production', undefined))
      .toThrow('JWT_SECRET is required');
  });

  it('rejects short production secrets', () => {
    expect(() => validateJwtSecret('production', 'too-short'))
      .toThrow('at least 32 characters');
  });

  it('rejects the placeholder in production', () => {
    expect(() => validateJwtSecret('production', JWT_SECRET_PLACEHOLDER))
      .toThrow('cannot use the placeholder');
  });

  it('accepts a valid production secret', () => {
    expect(validateJwtSecret('production', 'x'.repeat(32)))
      .toBe('x'.repeat(32));
  });
});

describe('require-auth-for-read parsing', () => {
  it('defaults to false', () => {
    expect(parseRequireAuthForRead(undefined)).toBe(false);
  });

  it('accepts enabled truthy values', () => {
    expect(parseRequireAuthForRead('true')).toBe(true);
    expect(parseRequireAuthForRead('1')).toBe(true);
    expect(parseRequireAuthForRead('YES')).toBe(true);
  });

  it('rejects other values', () => {
    expect(parseRequireAuthForRead('false')).toBe(false);
    expect(parseRequireAuthForRead('random')).toBe(false);
  });
});
