import { describe, it, expect } from 'vitest';
import { jsonToToon, toonToJson } from './index';

describe('Tabular arrays detection and behavior', () => {
  it('detects tabular arrays and emits tabular header', () => {
    const arr = [{ a: 1, b: 2 }, { a: 2, b: 3 }];
    const t = jsonToToon({ rows: arr });
    expect(t).toContain('rows[2]{a,b}:');
    const decoded = toonToJson(t);
    expect(decoded).toEqual({ rows: arr });
  });

  it('rejects tabular row width mismatch in strict mode', () => {
    const input = 'rows[2]{a,b}:\n  1,2\n  1';
    expect(() => toonToJson(input)).toThrow(/Tabular row width mismatch/);
  });
  it('skips tabular detection when object shapes differ', () => {
    const arr = [{ a: 1, b: 2 }, { a: 2, c: 3 }];
    const t = jsonToToon({ rows: arr });
    // Not a tabular header because fields mismatch
    expect(t).toContain('rows[2]:');
  });
});
