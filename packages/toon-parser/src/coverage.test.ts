
import { describe, it, expect } from 'vitest';
import { jsonToToon, toonToJson } from './index';

describe('Coverage & Edge Case Gaps', () => {

  describe('decodeKey Invalid Inputs', () => {
    it('throws on unquoted key starting with invalid character', () => {
      // Key cannot start with number unless quoted
      expect(() => toonToJson('123key: "val"')).toThrow(/Invalid key token/);
    });

    it('throws on unquoted key with special characters', () => {
      expect(() => toonToJson('key+val: "val"')).toThrow(/Invalid key token/);
    });

    it('throws on unquoted key containing delimiter (fails regex anyway)', () => {
      // SAFE_KEY_RE is stricter than delimiter check, so it throws "Invalid key token"
      expect(() => toonToJson('key,val: "val"')).toThrow(/Invalid key token/);
    });
  });

  describe('Tabular Fallback', () => {
    it('falls back to list format if object values are non-primitive', () => {
      const data = [
        { id: 1, info: { meta: 'not-primitive' } },
        { id: 2, info: { meta: 'x' } }
      ];
      const encoded = jsonToToon(data);
      expect(encoded).not.toContain(']{id,info}'); 
      // check for list items (dashes)
      expect(encoded).toContain('-');
      expect(toonToJson(encoded)).toEqual(data);
    });

    it('falls back to list format if objects have different keys', () => {
      const data = [
        { id: 1, a: 1 },
        { id: 2, b: 2 }
      ];
      const encoded = jsonToToon(data);
      expect(encoded).not.toContain(']{id,a}');
      expect(toonToJson(encoded)).toEqual(data);
    });
  });

  describe('Circular References', () => {
    it('throws error on circular reference', () => {
      const a: any = { name: 'a' };
      a.self = a;
      expect(() => jsonToToon(a)).toThrow(/Maximum depth \d+ exceeded/);
    });
  });

  describe('Tabular Header Pollution', () => {
     it('throws if tabular header contains disallowed keys when row is parsed', () => {
         // Must provide valid row to trigger field processing
         expect(() => toonToJson('[1]{__proto__}:\n  1')).toThrow(/Disallowed key "__proto__"/);
     });
  });
});
