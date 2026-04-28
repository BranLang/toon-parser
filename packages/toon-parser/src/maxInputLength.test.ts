import { describe, expect, it } from 'vitest';
import {
  csvToToon,
  htmlToToon,
  logToToon,
  toonToJson,
  ToonError,
  urlToToon,
  xmlToToon
} from './index.js';

describe('maxInputLength security cap', () => {
  it('toonToJson rejects oversize input', () => {
    const huge = 'a: 1\n'.repeat(20);
    expect(() => toonToJson(huge, { maxInputLength: 10 })).toThrow(ToonError);
  });

  it('toonToJson allows input exactly at the cap', () => {
    const text = 'a: 1';
    expect(() => toonToJson(text, { maxInputLength: text.length })).not.toThrow();
  });

  it.each([
    ['csvToToon', () => csvToToon('id,name\n1,a', { maxInputLength: 4 })],
    ['xmlToToon', () => xmlToToon('<a/>', { maxInputLength: 1 })],
    ['htmlToToon', () => htmlToToon('<div>x</div>', { maxInputLength: 1 })],
    ['logToToon', () => logToToon('a\nb', { maxInputLength: 1 })],
    ['urlToToon', () => urlToToon('?a=1&b=2', { maxInputLength: 1 })]
  ])('%s rejects oversize input', (_name, fn) => {
    expect(fn).toThrow(ToonError);
  });

  it('Infinity disables the cap', () => {
    const huge = 'a: 1\n'.repeat(1000);
    expect(() => toonToJson(huge, { maxInputLength: Infinity })).not.toThrow();
  });
});
