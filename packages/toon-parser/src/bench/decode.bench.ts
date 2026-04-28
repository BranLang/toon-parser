import { bench, describe } from 'vitest';
import { jsonToToon, toonToJson } from '../index.js';

const flatJson: Record<string, unknown> = {};
for (let i = 0; i < 50; i++) flatJson[`field_${i}`] = i;
const flatToon = jsonToToon(flatJson);
const flatJsonText = JSON.stringify(flatJson);

const tabularJson = Array.from({ length: 1000 }, (_, i) => ({
  id: i,
  name: `user_${i}`,
  active: i % 3 === 0,
  score: i * 1.5
}));
const tabularToon = jsonToToon(tabularJson);
const tabularJsonText = JSON.stringify(tabularJson);

const foldedJson = { org: { team: { project: { config: { enabled: true } } } } };
const foldedToon = jsonToToon(foldedJson, { keyFolding: 'safe' });

describe('decode — flat object (50 fields)', () => {
  bench('toonToJson', () => {
    toonToJson(flatToon);
  });

  bench('JSON.parse (baseline)', () => {
    JSON.parse(flatJsonText);
  });
});

describe('decode — tabular array (1000 rows)', () => {
  bench('toonToJson', () => {
    toonToJson(tabularToon);
  });

  bench('JSON.parse (baseline)', () => {
    JSON.parse(tabularJsonText);
  });
});

describe('decode — folded path round-trip', () => {
  bench('toonToJson (expandPaths=safe)', () => {
    toonToJson(foldedToon, { expandPaths: 'safe' });
  });

  bench('toonToJson (expandPaths=off, literal dotted key)', () => {
    toonToJson(foldedToon);
  });
});
