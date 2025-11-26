import { describe, it, expect } from 'vitest';
import { toonToJson } from './index';

describe('Toon parser strict vs non-strict and diagnostics', () => {
  it('allows inline length mismatch when strict false', () => {
    const result = toonToJson('vals[2]: 1', { strict: false });
    expect(result).toEqual({ vals: [1] });
  });

  it('includes line numbers in errors', () => {
    try {
      toonToJson('vals[2]: 1', { strict: true });
      throw new Error('Should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(Error);
      expect(String(err)).toMatch(/Line 1/);
      expect(String(err)).toMatch(/length mismatch/);
    }
  });
});
