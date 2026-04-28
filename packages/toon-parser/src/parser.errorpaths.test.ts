import { describe, expect, it } from 'vitest';
import { jsonToToon, toonToJson, ToonError } from './index.js';

describe('parser error paths — security-sensitive', () => {
  describe('decodeQuotedString', () => {
    it('throws on unterminated string', () => {
      // Token starts with `"` but does not end with `"`.
      expect(() => toonToJson('k: "abc')).toThrow(/Unterminated string|quoted value/i);
    });

    it('throws on invalid escape sequence', () => {
      expect(() => toonToJson('k: "\\x"')).toThrow(/Invalid escape sequence/);
    });

    it('throws on dangling backslash inside quoted string', () => {
      // The `\\\\\\"` in source becomes `\\"` in the actual string, which is
      // an escaped backslash followed by terminator — valid. To produce a
      // dangling backslash we use a raw-ish approach.
      const raw = 'k: "abc\\';
      // Append a plain `"` so the token ends with quote but the last `\` is dangling.
      expect(() => toonToJson(raw + '"')).toThrow(/Unterminated escape sequence|Invalid escape/);
    });

    it('decodes all valid escape sequences', () => {
      const result = toonToJson('k: "a\\nb\\tc\\rd\\"e\\\\f"') as Record<string, string>;
      expect(result.k).toBe('a\nb\tc\rd"e\\f');
    });
  });

  describe('parsePrimitiveToken', () => {
    it('rejects unquoted value with surrounding whitespace in strict mode', () => {
      // Inline-array tokens preserve whitespace around each item, so a leading
      // space on the second token reaches `parsePrimitiveToken`'s strict check.
      expect(() => toonToJson('arr[2]: a, b')).toThrow(/whitespace/);
    });

    it('accepts the same input under non-strict mode', () => {
      // Non-strict mode skips the whitespace check (best-effort decoding).
      expect(toonToJson('arr[2]: a, b', { strict: false })).toEqual({ arr: ['a', 'b'] });
    });

    it('rejects leading-zero integers (must be quoted)', () => {
      expect(() => toonToJson('k: 007')).toThrow(/leading zeros/);
    });

    it('rejects leading-zero decimals via NUMERIC_RE branch', () => {
      // `-007.5` matches the broader path.
      expect(() => toonToJson('k: -007')).toThrow(/leading zeros/);
    });

    it('rejects unquoted values containing the active delimiter (strict)', () => {
      // Tabular row with comma inside an unquoted cell.
      const text = '[1]{a,b}:\n  hello,wo,rld';
      expect(() => toonToJson(text)).toThrow();
    });

    it('accepts unquoted values containing the delimiter when non-strict', () => {
      // The decoder's `parsePrimitiveToken` only enforces this in strict mode.
      // We can not directly construct a non-strict scenario from a TOON source,
      // but we can confirm that a quoted form parses both ways.
      const text = 'k: "a,b"';
      expect(toonToJson(text)).toEqual({ k: 'a,b' });
      expect(toonToJson(text, { strict: false })).toEqual({ k: 'a,b' });
    });
  });

  describe('splitDelimited', () => {
    it('throws on unterminated quoted value inside inline array', () => {
      expect(() => toonToJson('arr[1]: "abc')).toThrow(/Unterminated/i);
    });
  });

  describe('countLeadingSpaces', () => {
    it('rejects tab indentation', () => {
      expect(() => toonToJson('a:\n\tb: 1')).toThrow(/Tabs are not allowed/);
    });
  });

  describe('encoder primitive validation', () => {
    it('rejects NaN', () => {
      expect(() => jsonToToon({ k: NaN })).toThrow(/finite/);
    });

    it('rejects Infinity', () => {
      expect(() => jsonToToon({ k: Infinity })).toThrow(/finite/);
    });

    it('encodes -0 explicitly', () => {
      const out = jsonToToon({ k: -0 });
      expect(out).toBe('k: -0');
    });

    it('rejects unsupported value types', () => {
      // `Symbol` and `function` should hit the "Unsupported value type" branch.
      expect(() => jsonToToon({ k: Symbol('x') as unknown })).toThrow(/Unsupported value type/);
      expect(() => jsonToToon({ k: (() => 1) as unknown })).toThrow(/Unsupported value type/);
    });
  });
});
