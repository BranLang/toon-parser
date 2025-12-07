import { describe, it, expect } from 'vitest';
import { logToToon } from './log';

/**
 * This test ensures that the CLF regex does not suffer from catastrophic backtracking (ReDoS).
 * It feeds a deliberately crafted long malicious CLF line that would cause the old regex to hang.
 * The new regex should process it quickly and return the raw line.
 */
describe('logToToon CLF ReDoS mitigation', () => {
  it('parses malicious CLF line without hanging', () => {
    // Construct a malicious line: many repeated "a" characters inside the request part.
    const maliciousRequest = 'GET ' + 'a'.repeat(5000) + ' HTTP/1.1';
    const line = `127.0.0.1 - - [01/Jan/2020:00:00:00 +0000] "${maliciousRequest}" 200 1234`;
    const logData = line + '\n';
    const start = Date.now();
    const result = logToToon(logData);
    const duration = Date.now() - start;
    // The result should contain the raw line because the request part does not match the safe regex (no quotes inside).
    expect(result).toContain('GET');
    // Ensure the parsing completed quickly (under 100ms).
    expect(duration).toBeLessThan(100);
  });
});
