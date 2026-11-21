import { describe, expect, it } from 'vitest';
import {
  JWT_SECRET_PLACEHOLDER,
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
