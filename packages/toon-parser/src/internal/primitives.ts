import {
  DEFAULT_DELIMITER,
  LEADING_ZERO_RE,
  NUMERIC_LIKE_RE,
  NUMERIC_RE,
  SAFE_KEY_RE
} from './constants.js';
import { ToonError } from './errors.js';
import { validateKeySafety } from './security.js';
import type { Delimiter, JsonPrimitive, Limits } from './types.js';
import { DEFAULT_LIMITS } from './constants.js';

export function encodePrimitive(
  value: JsonPrimitive,
  activeDelimiter: Delimiter,
  documentDelimiter: Delimiter
): string {
  if (value === null) return 'null';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new ToonError('Numeric values must be finite.');
    }
    if (Object.is(value, -0)) return '-0';
    return String(value);
  }
  return encodeString(value, activeDelimiter, documentDelimiter);
}

export function encodeString(
  value: string,
  activeDelimiter: Delimiter,
  documentDelimiter: Delimiter
): string {
  const needsQuote =
    value.length === 0 ||
    /^\s|\s$/.test(value) ||
    value === 'true' ||
    value === 'false' ||
    value === 'null' ||
    NUMERIC_LIKE_RE.test(value) ||
    LEADING_ZERO_RE.test(value) ||
    value.includes(':') ||
    value.includes('"') ||
    value.includes('\\') ||
    /[\[\]{}]/.test(value) ||
    /[\n\r\t]/.test(value) ||
    value.includes(activeDelimiter) ||
    value.includes(documentDelimiter) ||
    value === '-' ||
    value.startsWith('-');

  if (!needsQuote) {
    return value;
  }
  return `"${escapeString(value)}"`;
}

export function escapeString(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t');
}

export function encodeKey(key: string, activeDelimiter: Delimiter): string {
  if (SAFE_KEY_RE.test(key) && !key.includes(activeDelimiter)) {
    return key;
  }
  return `"${escapeString(key)}"`;
}

export function decodeKey(token: string, lineNo: number): string {
  const trimmed = token.trim();
  if (trimmed.startsWith('"')) {
    return decodeQuotedString(trimmed, lineNo);
  }
  if (!SAFE_KEY_RE.test(trimmed)) {
    throw new ToonError('Invalid key token.', lineNo);
  }
  return trimmed;
}

export function decodeQuotedString(token: string, lineNo: number): string {
  if (!token.endsWith('"')) {
    throw new ToonError('Unterminated string.', lineNo);
  }
  let result = '';
  let escape = false;
  for (let i = 1; i < token.length - 1; i++) {
    const ch = token[i];
    if (escape) {
      if (ch === '"' || ch === '\\') {
        result += ch;
      } else if (ch === 'n') {
        result += '\n';
      } else if (ch === 'r') {
        result += '\r';
      } else if (ch === 't') {
        result += '\t';
      } else {
        throw new ToonError(`Invalid escape sequence \\${ch}.`, lineNo);
      }
      escape = false;
      continue;
    }
    if (ch === '\\') {
      escape = true;
      continue;
    }
    result += ch;
  }
  if (escape) {
    throw new ToonError('Unterminated escape sequence.', lineNo);
  }
  return result;
}

export function parsePrimitiveToken(
  token: string,
  delimiter: Delimiter,
  lineNo: number,
  strict: boolean
): JsonPrimitive {
  if (token === '') {
    return '';
  }
  const trimmed = token.trim();
  if (trimmed !== token && strict) {
    throw new ToonError('Unquoted values may not contain leading or trailing whitespace.', lineNo);
  }
  if (trimmed.startsWith('"')) {
    return decodeQuotedString(trimmed, lineNo);
  }
  if (trimmed === 'true') return true;
  if (trimmed === 'false') return false;
  if (trimmed === 'null') return null;
  if (/^-?\d+$/.test(trimmed) && /^-?0\d+$/.test(trimmed)) {
    throw new ToonError('Numbers with leading zeros must be quoted.', lineNo);
  }
  if (NUMERIC_RE.test(trimmed)) {
    if (/^-?0\d+/.test(trimmed)) {
      throw new ToonError('Numbers with leading zeros must be quoted.', lineNo);
    }
    const num = Number(trimmed);
    if (!Number.isFinite(num)) {
      throw new ToonError('Invalid numeric value.', lineNo);
    }
    return num;
  }
  if (strict && trimmed.includes(delimiter)) {
    throw new ToonError('Unquoted value contains the active delimiter.', lineNo);
  }
  return trimmed;
}

export function primitiveLine(
  key: string | null,
  value: JsonPrimitive,
  indent: string,
  activeDelimiter: Delimiter,
  limits: Limits = DEFAULT_LIMITS
): string {
  const encodedValue = encodePrimitive(value, activeDelimiter, activeDelimiter);
  if (key === null) {
    return `${indent}${encodedValue}`;
  }
  validateKeySafety(key, limits);
  return `${indent}${encodeKey(key, activeDelimiter)}: ${encodedValue}`;
}

export function splitDelimited(text: string, delimiter: Delimiter, lineNo: number): string[] {
  const tokens: string[] = [];
  let current = '';
  let inQuote = false;
  let escape = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (escape) {
      current += ch;
      escape = false;
      continue;
    }
    if (ch === '\\') {
      current += ch;
      escape = true;
      continue;
    }
    if (ch === '"') {
      current += ch;
      inQuote = !inQuote;
      continue;
    }
    if (!inQuote && ch === delimiter) {
      tokens.push(current);
      current = '';
      continue;
    }
    current += ch;
  }
  if (inQuote) {
    throw new ToonError('Unterminated quoted value.', lineNo);
  }
  tokens.push(current);
  return tokens;
}

export function findUnquotedColon(text: string): number {
  let inQuote = false;
  let escape = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (ch === '\\') {
      escape = true;
      continue;
    }
    if (ch === '"') {
      inQuote = !inQuote;
      continue;
    }
    if (!inQuote && ch === ':') {
      return i;
    }
  }
  return -1;
}

export function countLeadingSpaces(text: string, lineNo: number): number {
  let count = 0;
  for (const ch of text) {
    if (ch === ' ') {
      count++;
    } else if (ch === '\t') {
      throw new ToonError('Tabs are not allowed for indentation.', lineNo);
    } else {
      break;
    }
  }
  return count;
}

export function splitKeyHeader(token: string): { rawKey: string; header?: string } {
  let inQuote = false;
  let escape = false;
  for (let i = 0; i < token.length; i++) {
    const ch = token[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (ch === '\\') {
      escape = true;
      continue;
    }
    if (ch === '"') {
      inQuote = !inQuote;
      continue;
    }
    if (!inQuote && ch === '[') {
      return {
        rawKey: token.slice(0, i).trim(),
        header: token.slice(i).trim()
      };
    }
  }
  return { rawKey: token.trim() };
}

export function parseArrayHeaderFromList(
  token: string,
  lineNo: number
): { length: number; delimiter: Delimiter; fields?: string[] } {
  const match = token.match(/^\[(\d+)([,\|\t])?\](\{(.+)\})?$/);
  if (!match) {
    throw new ToonError(`Invalid array header "${token}".`, lineNo);
  }
  const length = parseInt(match[1]!, 10);
  const delimiter = (match[2] as Delimiter | undefined) ?? DEFAULT_DELIMITER;
  const fieldsRaw = match[4];
  const fields = fieldsRaw ? splitDelimited(fieldsRaw, delimiter, lineNo).map(f => decodeKey(f, lineNo)) : undefined;
  return { length, delimiter, fields };
}

export function classifyTabularLine(line: string, delimiter: Delimiter): 'row' | 'field' {
  let inQuote = false;
  let escape = false;
  let firstColon = -1;
  let firstDelim = -1;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (ch === '\\') {
      escape = true;
      continue;
    }
    if (ch === '"') {
      inQuote = !inQuote;
      continue;
    }
    if (inQuote) continue;
    if (ch === ':' && firstColon === -1) firstColon = i;
    if (ch === delimiter && firstDelim === -1) firstDelim = i;
  }
  if (firstColon === -1) return 'row';
  if (firstDelim === -1) return 'field';
  return firstDelim < firstColon ? 'row' : 'field';
}
