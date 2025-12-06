
import { describe, it, expect } from 'vitest';
import { jsonToToon, toonToJson } from './index';

describe('Smoke Tests: Unexpected Inputs & Edge Cases', () => {

  describe('Unsupported Types', () => {
    it('throws on RegExp', () => {
      expect(() => jsonToToon({ regex: /abc/ })).toThrow(/Unsupported value type/);
    });

    it('throws on Map', () => {
      expect(() => jsonToToon({ map: new Map() })).toThrow(/Unsupported value type/);
    });

    it('throws on Set', () => {
      expect(() => jsonToToon({ set: new Set() })).toThrow(/Unsupported value type/);
    });

    it('throws on Function', () => {
      expect(() => jsonToToon({ fn: () => {} })).toThrow(/Unsupported value type/);
    });

    it('throws on Symbol', () => {
      expect(() => jsonToToon({ sym: Symbol('sym') })).toThrow(/Unsupported value type/);
    });
    
    // Note: undefined in object usually means "omit" in JSON, but our parser
    // treats `isPrimitive` as false for undefined, and `isPlainObject` as false.
    // So it might throw "Unsupported value type: undefined".
    // This test confirms that behavior.
    it('throws on undefined values (unlike JSON.stringify which omits them)', () => {
       expect(() => jsonToToon({ val: undefined })).toThrow(/Unsupported value type: undefined/);
    });
  });

  describe('Numeric Edge Cases', () => {
    it('handles NaN (converts to string or throws?) - current impl expects finite numbers', () => {
      // isPrimitive returns true for number, but encodePrimitive throws if !Number.isFinite
      expect(() => jsonToToon({ val: NaN })).toThrow(/Numeric values must be finite/);
    });

    it('handles Infinity', () => {
      expect(() => jsonToToon({ val: Infinity })).toThrow(/Numeric values must be finite/);
    });

    it('handles -Infinity', () => {
        expect(() => jsonToToon({ val: -Infinity })).toThrow(/Numeric values must be finite/);
    });

    it('handles negative zero', () => {
       const result = jsonToToon({ val: -0 });
       expect(result).toContain('-0');
       const decoded = toonToJson(result);
       expect(decoded).toEqual({ val: -0 });
    });
  });

  describe('String Quoting & Special Characters', () => {
    it('quotes strings that look like boolean/null', () => {
      const data = { a: 'true', b: 'false', c: 'null' };
      const encoded = jsonToToon(data);
      expect(encoded).toContain('"true"');
      expect(encoded).toContain('"false"');
      expect(encoded).toContain('"null"');
      expect(toonToJson(encoded)).toEqual(data);
    });

    it('quotes strings that look like numbers', () => {
        const data = { a: '123', b: '-45.67' };
        const encoded = jsonToToon(data);
        expect(encoded).toContain('"123"');
        expect(encoded).toContain('"-45.67"');
        expect(toonToJson(encoded)).toEqual(data);
    });

    it('quotes strings with leading zeros', () => {
        const data = { code: '007' };
        const encoded = jsonToToon(data);
        expect(encoded).toContain('"007"');
        expect(toonToJson(encoded)).toEqual(data);
    });

    it('quotes strings containing delimiters', () => {
        const data = { val: 'a,b|c' };
        const encoded = jsonToToon(data);
        // Default delimiter is comma
        expect(encoded).toContain('"a,b|c"');
        expect(toonToJson(encoded)).toEqual(data);
    });

    it('handles emoji and unicode', () => {
        const data = { '🚀': 'To the moon 🌕', 'über': 'münchen' };
        const encoded = jsonToToon(data);
        expect(encoded).toContain('🚀');
        expect(encoded).toContain('🌕');
        expect(toonToJson(encoded)).toEqual(data);
    });
    
    it('handles control characters by escaping', () => {
        const data = { newline: 'line1\nline2', tab: 'col1\tcol2' };
        const encoded = jsonToToon(data);
        expect(encoded).toContain('\\n');
        expect(encoded).toContain('\\t');
        expect(toonToJson(encoded)).toEqual(data);
    });
  });

  describe('Deep Nesting', () => {
      it('throws when max depth is exceeded', () => {
          // default maxDepth is 64
          let deep: any = { val: 1 };
          for (let i = 0; i < 70; i++) {
              deep = { next: deep };
          }
          expect(() => jsonToToon(deep)).toThrow(/Maximum depth 64 exceeded/);
      });
  });

  describe('Dates (Standard Smoke)', () => {
      it('supports multiple Date objects in array', () => {
          const dates = [new Date('2023-01-01'), new Date('2024-01-01')];
          const encoded = jsonToToon(dates);
          expect(encoded).toContain('2023');
          expect(encoded).toContain('2024');
          // Note: toonToJson converts them back to strings (JSON behavior), not Date objects
          // unless a reviver is used (which `toonToJson` doesn't support yet).
          // so we expect strings back.
          const decoded = toonToJson(encoded);
          expect(decoded).toEqual(dates.map(d => d.toISOString()));
      });
  });
});
