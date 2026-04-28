import { describe, expect, it } from 'vitest';
import { jsonToToon, toonToJson, ToonError } from './index.js';

describe('v3 §13.4 key folding (encoder)', () => {
  it('does nothing by default', () => {
    const out = jsonToToon({ a: { b: { c: 1 } } });
    expect(out).toBe(['a:', '  b:', '    c: 1'].join('\n'));
  });

  it('folds single-key chains in safe mode', () => {
    const out = jsonToToon({ a: { b: { c: 1 } } }, { keyFolding: 'safe' });
    expect(out).toBe('a.b.c: 1');
  });

  it('folds chain with inline primitive array leaf', () => {
    const out = jsonToToon(
      { data: { meta: { items: ['x', 'y'] } } },
      { keyFolding: 'safe' }
    );
    expect(out).toBe('data.meta.items[2]: x,y');
  });

  it('folds chain with tabular array leaf', () => {
    const out = jsonToToon(
      { a: { b: { items: [{ id: 1, name: 'A' }, { id: 2, name: 'B' }] } } },
      { keyFolding: 'safe' }
    );
    expect(out).toBe(
      ['a.b.items[2]{id,name}:', '  1,A', '  2,B'].join('\n')
    );
  });

  it('respects flattenDepth (per-chain limit)', () => {
    // flattenDepth=2 truncates each chain to at most two folded segments.
    // Inner chain c.d still folds independently because it is its own chain.
    const out = jsonToToon(
      { a: { b: { c: { d: 1 } } } },
      { keyFolding: 'safe', flattenDepth: 2 }
    );
    expect(out).toBe(['a.b:', '  c.d: 1'].join('\n'));
  });

  it('does not fold multi-key intermediate object', () => {
    const out = jsonToToon(
      { a: { b: 1, c: 2 } },
      { keyFolding: 'safe' }
    );
    expect(out).toBe(['a:', '  b: 1', '  c: 2'].join('\n'));
  });

  it('does not fold when segment fails IdentifierSegment grammar', () => {
    const out = jsonToToon(
      { a: { 'b.c': { d: 1 } } },
      { keyFolding: 'safe' }
    );
    // 'b.c' is not an IdentifierSegment, so folding stops at "a".
    // 'a' alone is not a chain (length<2), so no fold.
    expect(out).toContain('a:');
    expect(out).not.toContain('a.b.c.d');
  });

  it('refuses to fold into a path that collides with a sibling', () => {
    const out = jsonToToon(
      { a: { b: 1 }, 'a.b': 99 },
      { keyFolding: 'safe' }
    );
    // Fold of {a:{b:1}} -> "a.b: 1" would collide with literal sibling "a.b": 99.
    // The fold must be skipped — `a` is emitted as a normal block.
    expect(out).toContain('a:\n  b: 1');
  });

  it('refuses to fold disallowed keys (prototype pollution guard)', () => {
    expect(() =>
      jsonToToon(
        { __proto__: { evil: 1 } } as Record<string, unknown>,
        { keyFolding: 'safe' }
      )
    ).toThrow(ToonError);
  });

  it('round-trips folded output via expandPaths', () => {
    const original = { a: { b: { c: 1, d: 'x' } } };
    const encoded = jsonToToon(original, { keyFolding: 'safe' });
    const decoded = toonToJson(encoded, { expandPaths: 'safe' });
    expect(decoded).toEqual(original);
  });
});

describe('v3 §13.4 path expansion (decoder)', () => {
  it('does nothing by default — dotted keys stay literal', () => {
    const result = toonToJson('a.b.c: 1') as Record<string, unknown>;
    expect(result).toEqual({ 'a.b.c': 1 });
  });

  it('expands dotted keys in safe mode', () => {
    const result = toonToJson('a.b.c: 1', { expandPaths: 'safe' });
    expect(result).toEqual({ a: { b: { c: 1 } } });
  });

  it('deep-merges multiple expanded paths', () => {
    const text = ['a.b.c: 1', 'a.b.d: 2', 'a.e: 3'].join('\n');
    const result = toonToJson(text, { expandPaths: 'safe' });
    expect(result).toEqual({ a: { b: { c: 1, d: 2 }, e: 3 } });
  });

  it('errors on object/primitive conflict in strict mode', () => {
    const text = ['a.b: 1', 'a: 2'].join('\n');
    expect(() => toonToJson(text, { expandPaths: 'safe' })).toThrow(/conflict/i);
  });

  it('LWW resolution when strict=false', () => {
    const text = ['a.b: 1', 'a: 2'].join('\n');
    const result = toonToJson(text, { expandPaths: 'safe', strict: false });
    expect(result).toEqual({ a: 2 });
  });

  it('rejects expansion on disallowed key segments', () => {
    expect(() =>
      toonToJson('__proto__.evil: 1', { expandPaths: 'safe' })
    ).toThrow(ToonError);
  });

  it('keeps key literal if any segment is not an IdentifierSegment', () => {
    // "1bad" starts with a digit — not a valid IdentifierSegment.
    const result = toonToJson('"a.1bad": 1', { expandPaths: 'safe' });
    expect(result).toEqual({ 'a.1bad': 1 });
  });

  it('expands nested array headers correctly', () => {
    const text = 'data.items[2]: x,y';
    const result = toonToJson(text, { expandPaths: 'safe' });
    expect(result).toEqual({ data: { items: ['x', 'y'] } });
  });
});
