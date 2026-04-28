import { bench, describe } from 'vitest';
import { jsonToToon } from '../index.js';

const flatObject: Record<string, unknown> = {};
for (let i = 0; i < 50; i++) flatObject[`field_${i}`] = i;

const tabularRows = Array.from({ length: 1000 }, (_, i) => ({
  id: i,
  name: `user_${i}`,
  active: i % 3 === 0,
  score: i * 1.5
}));

const nestedSingleKeyChain = {
  org: {
    team: {
      project: {
        config: {
          enabled: true
        }
      }
    }
  }
};

const mixed = {
  meta: { generatedAt: '2026-04-28T00:00:00Z', version: '3.0.0' },
  tags: ['toon', 'parser', 'bench'],
  rows: tabularRows.slice(0, 100),
  flat: flatObject
};

describe('encode — flat object (50 fields)', () => {
  bench('jsonToToon', () => {
    jsonToToon(flatObject);
  });

  bench('JSON.stringify (baseline)', () => {
    JSON.stringify(flatObject);
  });
});

describe('encode — tabular array (1000 rows)', () => {
  bench('jsonToToon', () => {
    jsonToToon(tabularRows);
  });

  bench('JSON.stringify (baseline)', () => {
    JSON.stringify(tabularRows);
  });
});

describe('encode — single-key chain (with vs without folding)', () => {
  bench('jsonToToon (no folding)', () => {
    jsonToToon(nestedSingleKeyChain);
  });

  bench('jsonToToon (keyFolding=safe)', () => {
    jsonToToon(nestedSingleKeyChain, { keyFolding: 'safe' });
  });

  bench('JSON.stringify (baseline)', () => {
    JSON.stringify(nestedSingleKeyChain);
  });
});

describe('encode — mixed payload', () => {
  bench('jsonToToon', () => {
    jsonToToon(mixed);
  });

  bench('jsonToToon (sortKeys=true)', () => {
    jsonToToon(mixed, { sortKeys: true });
  });

  bench('JSON.stringify (baseline)', () => {
    JSON.stringify(mixed);
  });
});
