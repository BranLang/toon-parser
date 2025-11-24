import { describe, it, expect } from 'vitest';
import * as esmModule from './index';
import fs from 'fs';
import path from 'path';

const distPath = path.join(__dirname, '..', 'dist', 'index.cjs');

describe('CJS built package', () => {
  it('exposes same API as ESM source (if built)', () => {
    if (!fs.existsSync(distPath)) {
      // dist not present (local dev run without `npm run build`), skip assertion
      expect(true).toBeTruthy();
      return;
    }
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const cjs = require(distPath) as typeof esmModule;
    expect(typeof cjs.jsonToToon).toBe('function');
    expect(typeof cjs.toonToJson).toBe('function');

    const sample = { a: 1, b: 'x' };
    const e = esmModule.jsonToToon(sample);
    const d = cjs.jsonToToon(sample);
    expect(e).toBeDefined();
    expect(d).toBeDefined();
    expect(esmModule.toonToJson(e)).toEqual(sample);
    expect(cjs.toonToJson(d)).toEqual(sample);
  });
});
