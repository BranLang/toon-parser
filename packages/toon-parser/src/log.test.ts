import { describe, it, expect } from 'vitest';
import { logToToon } from './log';

describe('logToToon', () => {
  it('converts json logs', () => {
    const logs = `{"id":1}\n{"id":2}`;
    const toon = logToToon(logs, { format: 'json' });
    // [2]{id}:
    //   1
    //   2
    expect(toon).toContain('[2]{id}:');
    expect(toon).toContain('1');
    expect(toon).toContain('2');
  });

  it('converts CLF logs', () => {
    const log = `127.0.0.1 - - [10/Oct:13:55:36] "GET /index.html" 200 1024`;
    const toon = logToToon(log, { format: 'clf' });
    expect(toon).toContain('host');
    expect(toon).toContain('ident');
    expect(toon).toContain('authuser');
    expect(toon).toContain('127.0.0.1');
    expect(toon).toContain('GET /index.html');
  });

  it('converts Combined Log Format logs (referer + user-agent)', () => {
    const log = `127.0.0.1 - alice [10/Oct:13:55:36] "GET / HTTP/1.1" 200 1024 "https://example.com/" "Mozilla/5.0"`;
    const toon = logToToon(log, { format: 'combined' });
    expect(toon).toContain('referer');
    expect(toon).toContain('userAgent');
    expect(toon).toContain('https://example.com/');
    expect(toon).toContain('Mozilla/5.0');
  });

  it('auto mode prefers Combined when extra fields present, falls back to Common', () => {
    const mixed = [
      '127.0.0.1 - - [10/Oct:13:55:36] "GET /a" 200 1024 "-" "curl/8"',
      '10.0.0.1 - - [10/Oct:13:55:37] "GET /b" 404 -'
    ].join('\n');
    const toon = logToToon(mixed);
    expect(toon).toContain('curl/8');
    expect(toon).toContain('GET /b');
  });

  it('handles size=- as null', () => {
    const log = `1.1.1.1 - - [10/Oct:13:55:36] "GET /missing" 304 -`;
    const toon = logToToon(log, { format: 'clf' });
    expect(toon).toContain('null');
  });

  it('falls back to raw for non-CLF lines', () => {
    const log = 'this is not a CLF line';
    const toon = logToToon(log);
    expect(toon).toContain('raw');
    expect(toon).toContain('this is not a CLF line');
  });
});
