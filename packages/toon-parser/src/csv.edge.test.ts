import { csvToJson, csvToToon } from '../src/csv';
import { expect, test } from 'vitest';

test('malformed CSV throws error', () => {
  const malformed = 'a,b\n1,2,3'; // extra column
  expect(() => csvToJson(malformed)).toThrow();
});

test('empty CSV returns empty array', () => {
  const empty = '';
  const result = csvToJson(empty);
  expect(result).toEqual([]);
});

test('multi-character delimiter is rejected', () => {
  const data = 'a|b\n1|2';
  expect(() => csvToJson(data, { delimiter: '||' })).toThrow();
});

test('row length mismatch throws in csvToToon', () => {
  const malformed = 'a,b\n1,2,3';
  expect(() => csvToToon(malformed)).toThrow();
});
