import { describe, expect, it } from 'vitest';
import { jsonToToon, toonToJson } from './index';

describe('json-toon parser', () => {
  it('round-trips objects with tabular arrays', () => {
    const payload = {
      context: { task: 'hike planning', year: 2025 },
      friends: ['ana', 'luis', 'sam'],
      hikes: [
        { id: 1, name: 'Blue Lake', distanceKm: 7.5, wasSunny: true },
        { id: 2, name: 'Ridge Overlook', distanceKm: 9.2, wasSunny: false }
      ]
    };

    const toon = jsonToToon(payload);
    expect(toon).toContain('hikes[2]{id,name,distanceKm,wasSunny}');
    const decoded = toonToJson(toon);
    expect(decoded).toEqual(payload);
  });

  it('quotes strings that could be misread as primitives', () => {
    const payload = {
      literalTrue: 'true',
      spaced: ' leading',
      dash: '-value',
      colon: 'a:b'
    };
    const toon = jsonToToon(payload);
    expect(toon).toContain('"true"');
    expect(toon).toContain('" leading"');
    expect(toon).toContain('"-value"');
    const decoded = toonToJson(toon);
    expect(decoded).toEqual(payload);
  });

  it('rejects prototype-polluting keys when encoding and decoding', () => {
    const polluted = Object.create(null) as Record<string, unknown>;
    polluted['__proto__'] = 1;
    expect(() => jsonToToon(polluted)).toThrow(/Disallowed key/);
    expect(() => toonToJson('__proto__: 1')).toThrow(/Disallowed key/);
  });

  it('enforces declared array lengths in strict mode', () => {
    expect(() => toonToJson('nums[2]: 1')).toThrow(/length mismatch/);
  });

  it('rejects numbers with leading zeros', () => {
    expect(() => toonToJson('value: 007')).toThrow(/leading zeros/);
  });

  it('round-trips nested array items that contain objects', () => {
    const payload = [
      [
        { id: 1, label: 'alpha' },
        { id: 2, label: 'beta' }
      ]
    ];

    const toon = jsonToToon(payload);
    const decoded = toonToJson(toon);
    expect(decoded).toEqual(payload);
  });
});
