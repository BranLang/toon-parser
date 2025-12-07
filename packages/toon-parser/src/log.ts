import { jsonToToon, JsonToToonOptions } from './index.js';

export interface LogToToonOptions extends JsonToToonOptions {
  /**
   * Log format. Defaults to 'auto' which tries to detect CLF or JSON.
   */
  format?: 'auto' | 'clf' | 'json';
}

const CLF_REGEX = /^(\S+) - - \[(.*?)\] "(.*?)" (\d+) (\d+)$/;

export function logToToon(logData: string, options: LogToToonOptions = {}): string {
  const lines = logData.split(/\r?\n/).filter(line => line.trim() !== '');
  const format = options.format ?? 'auto';

  // Attempt JSON detection on first line
  if (format === 'json' || (format === 'auto' && lines[0]?.trim().startsWith('{'))) {
      const logs = lines.map(line => {
          try { return JSON.parse(line); } catch { return { raw: line }; }
      });
      return jsonToToon(logs, options);
  }

  // Attempt CLF (Common Log Format)
  // Format: host - - [date] "request" status size
  const parsed = lines.map(line => {
      const match = line.match(CLF_REGEX);
      if (match) {
          return {
              host: match[1] || '',
              date: match[2] || '',
              request: match[3] || '',
              status: parseInt(match[4] || '0', 10),
              size: parseInt(match[5] || '0', 10)
          };
      }
      return { raw: line };
  });

  return jsonToToon(parsed, options);
}
