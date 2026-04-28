import { describe, it, expect } from 'vitest';
import { jsonToToon } from './index';

describe('security enforcement and limits', () => {
  it('throws when maxDepth exceeded', () => {
    // create nested structure beyond default max depth 64
    let nested: any = { a: 1 };
    for (let i = 0; i < 70; i++) {
      nested = [nested];
    }
    expect(() => jsonToToon(nested)).toThrow(/Maximum depth/);
  });

  it('throws when maxArrayLength is exceeded', () => {
    const arr = new Array(50_001).fill(0);
    expect(() => jsonToToon({ arr })).toThrow(/Array length/);
  });

  it('throws when maxTotalNodes exceeded', () => {
    // create a large object that exceeds nodes
    const bigObj: Record<string, number> = {};
    for (let i = 0; i < 1000; i++) bigObj['k' + i] = i;
    expect(() => jsonToToon(bigObj, { maxTotalNodes: 100 })).toThrow(/Node count/);
  });

  it('counts each value once (no encoder double-bump)', () => {
    // {a: 1, b: 2} = 3 nodes (object + 2 values). With double-counting this
    // would be 6+, which would trip a maxTotalNodes=4 limit.
    expect(() => jsonToToon({ a: 1, b: 2 }, { maxTotalNodes: 4 })).not.toThrow();
    // {a: 1} = 2 nodes (object + value). cap=1 still trips.
    expect(() => jsonToToon({ a: 1 }, { maxTotalNodes: 1 })).toThrow(/Node count/);
  });
});
