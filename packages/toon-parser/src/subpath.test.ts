import { describe, expect, it } from 'vitest';

// Verify each adapter resolves cleanly via its sub-path module.
// (We import via the workspace package name when available; otherwise
// the relative path documents the wiring.)

describe('sub-path module imports', () => {
  it('csv module exports csvToToon and csvToJson', async () => {
    const mod = await import('./csv.js');
    expect(typeof mod.csvToToon).toBe('function');
    expect(typeof mod.csvToJson).toBe('function');
  });

  it('xml module exports xmlToToon and xmlToJson', async () => {
    const mod = await import('./xml.js');
    expect(typeof mod.xmlToToon).toBe('function');
    expect(typeof mod.xmlToJson).toBe('function');
  });

  it('html module exports htmlToToon and htmlToJson', async () => {
    const mod = await import('./html.js');
    expect(typeof mod.htmlToToon).toBe('function');
    expect(typeof mod.htmlToJson).toBe('function');
  });

  it('log module exports logToToon', async () => {
    const mod = await import('./log.js');
    expect(typeof mod.logToToon).toBe('function');
  });

  it('url module exports urlToToon', async () => {
    const mod = await import('./url.js');
    expect(typeof mod.urlToToon).toBe('function');
  });

  it('core module exposes the encoder/decoder without dragging adapters', async () => {
    const core = await import('./core.js');
    expect(typeof core.jsonToToon).toBe('function');
    expect(typeof core.toonToJson).toBe('function');
    expect(typeof core.ToonError).toBe('function');
    expect(typeof core.enforceInputLength).toBe('function');
    // Critically: the core barrel must NOT re-export the format adapters.
    // Sub-path consumers rely on this for tree-shaking.
    expect((core as Record<string, unknown>).csvToToon).toBeUndefined();
    expect((core as Record<string, unknown>).xmlToToon).toBeUndefined();
  });
});
