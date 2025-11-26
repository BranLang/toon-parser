import { describe, it, expect } from 'vitest';
import { jsonToToon, toonToJson } from './index';

describe('Edge case tests', () => {
  it('round-trips arrays with empty objects', () => {
    const data = { arr: [{}, { id: 1 }] };
    const t = jsonToToon(data);
    const back = toonToJson(t);
    expect(back).toEqual(data);
  });

  it('round-trips keys with punctuation (quoted)', () => {
    const data = { 'a b': 1, '!ok': 2 };
    const t = jsonToToon(data);
    const back = toonToJson(t);
    expect(back).toEqual(data);
  });

  it('handles strings with delimiter and colon characters by quoting', () => {
    const data = { val: '1,2:3|x' };
    const t = jsonToToon(data, { delimiter: ',' });
    const back = toonToJson(t);
    expect(back).toEqual(data);
  });
});
