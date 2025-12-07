import { xmlToJson, xmlToToon } from '../src/xml';
import { expect, test } from 'vitest';

test('malformed XML throws error', () => {
  const badXml = '<root><unclosed></root>';
  expect(() => xmlToJson(badXml)).toThrow();
});

test('empty XML returns empty object', () => {
  const empty = '';
  const result = xmlToJson(empty);
  expect(result).toEqual({});
});

test('malformed XML throws in xmlToToon', () => {
  const badXml = '<root><unclosed></root>';
  expect(() => xmlToToon(badXml)).toThrow();
});
