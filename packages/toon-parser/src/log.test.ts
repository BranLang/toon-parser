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
    expect(toon).toContain('[1]{host,date,request,status,size}:');
    expect(toon).toContain('127.0.0.1');
    expect(toon).toContain('GET /index.html');
  });
});
