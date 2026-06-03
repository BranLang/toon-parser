import { afterEach, describe, expect, it } from 'vitest';
import { urlToToon, ToonError } from './index.js';

describe('urlToToon — prototype pollution guards', () => {
  afterEach(() => {
    // Defensive cleanup in case any test ever leaks (it shouldn't).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (Object.prototype as any).polluted;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (Object.prototype as any).isAdmin;
  });

  it('rejects bracket __proto__ in URL parameters', () => {
    expect(() => urlToToon('__proto__[polluted]=YES')).toThrow(ToonError);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(({} as any).polluted).toBeUndefined();
  });

  it('rejects dotted __proto__ in URL parameters', () => {
    expect(() => urlToToon('__proto__.isAdmin=true')).toThrow(ToonError);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(({} as any).isAdmin).toBeUndefined();
  });

  it('rejects nested constructor.prototype path', () => {
    expect(() =>
      urlToToon('constructor[prototype][isAdmin]=true')
    ).toThrow(ToonError);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(({} as any).isAdmin).toBeUndefined();
  });

  it('honors caller-supplied disallowedKeys', () => {
    expect(() =>
      urlToToon('forbidden[x]=1', { disallowedKeys: ['forbidden'] })
    ).toThrow(/Disallowed key "forbidden"/);
  });

  it('extraDisallowedKeys augments without dropping prototype guards', () => {
    // Caller adds "tenantId" but should still be protected against __proto__.
    expect(() =>
      urlToToon('__proto__.polluted=YES', { extraDisallowedKeys: ['tenantId'] })
    ).toThrow(ToonError);
    expect(() =>
      urlToToon('tenantId[x]=1', { extraDisallowedKeys: ['tenantId'] })
    ).toThrow(/Disallowed key "tenantId"/);
  });

  it('still parses normal nested params correctly', () => {
    const out = urlToToon('user[name]=alice&user[age]=30');
    expect(out).toContain('name: alice');
    expect(out).toContain('age: 30');
  });
});
