import { jsonToToon, JsonToToonOptions, enforceInputLength } from './core.js';

export interface LogToToonOptions extends JsonToToonOptions {
  /**
   * Log format. Defaults to 'auto' which tries to detect Common/Combined Log
   * Format or NDJSON. `'clf'` accepts both Common and Combined variants.
   */
  format?: 'auto' | 'clf' | 'combined' | 'json';
}

// Common Log Format:    host identd authuser [date] "request" status size
// Combined Log Format:  host identd authuser [date] "request" status size "referer" "user-agent"
// Negated character classes keep the regex linear (ReDoS-safe).
const COMMON_RE   = /^(\S+) (\S+) (\S+) \[([^\]]*)\] "([^"]*)" (\d+) (\d+|-)$/;
const COMBINED_RE = /^(\S+) (\S+) (\S+) \[([^\]]*)\] "([^"]*)" (\d+) (\d+|-) "([^"]*)" "([^"]*)"$/;

interface CommonRow {
  host: string;
  ident: string;
  authuser: string;
  date: string;
  request: string;
  status: number;
  size: number | null;
}
interface CombinedRow extends CommonRow {
  referer: string;
  userAgent: string;
}

function parseCommon(line: string): CommonRow | null {
  const m = line.match(COMMON_RE);
  if (!m) return null;
  return {
    host: m[1] ?? '',
    ident: m[2] ?? '-',
    authuser: m[3] ?? '-',
    date: m[4] ?? '',
    request: m[5] ?? '',
    status: parseInt(m[6] ?? '0', 10),
    size: m[7] === '-' ? null : parseInt(m[7] ?? '0', 10)
  };
}

function parseCombined(line: string): CombinedRow | null {
  const m = line.match(COMBINED_RE);
  if (!m) return null;
  return {
    host: m[1] ?? '',
    ident: m[2] ?? '-',
    authuser: m[3] ?? '-',
    date: m[4] ?? '',
    request: m[5] ?? '',
    status: parseInt(m[6] ?? '0', 10),
    size: m[7] === '-' ? null : parseInt(m[7] ?? '0', 10),
    referer: m[8] ?? '',
    userAgent: m[9] ?? ''
  };
}

export function logToToon(logData: string, options: LogToToonOptions = {}): string {
  enforceInputLength(logData, options);
  const lines = logData.split(/\r?\n/).filter(line => line.trim() !== '');
  const format = options.format ?? 'auto';

  if (format === 'json' || (format === 'auto' && lines[0]?.trim().startsWith('{'))) {
    const logs = lines.map(line => {
      try { return JSON.parse(line); } catch { return { raw: line }; }
    });
    return jsonToToon(logs, options);
  }

  if (format === 'combined') {
    const parsed = lines.map(line => parseCombined(line) ?? { raw: line });
    return jsonToToon(parsed, options);
  }

  if (format === 'clf') {
    const parsed = lines.map(line => parseCombined(line) ?? parseCommon(line) ?? { raw: line });
    return jsonToToon(parsed, options);
  }

  // 'auto': try Combined, then Common, fall back to raw line.
  const parsed = lines.map(line => parseCombined(line) ?? parseCommon(line) ?? { raw: line });
  return jsonToToon(parsed, options);
}
