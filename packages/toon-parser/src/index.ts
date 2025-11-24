export type JsonPrimitive = string | number | boolean | null;

export interface SecurityOptions {
  /**
   * Maximum nesting depth (objects + arrays). Defaults to 64.
   */
  maxDepth?: number;
  /**
   * Maximum allowed array length. Defaults to 50_000.
   */
  maxArrayLength?: number;
  /**
   * Maximum total nodes (object fields + array items) processed.
   * Defaults to 250_000 to limit resource exhaustion.
   */
  maxTotalNodes?: number;
  /**
   * Keys that are rejected to avoid prototype pollution.
   * Defaults to ["__proto__", "constructor", "prototype"].
   */
  disallowedKeys?: string[];
}

export interface JsonToToonOptions extends SecurityOptions {
  /**
   * Number of spaces per indentation level. Defaults to 2.
   */
  indent?: number;
  /**
   * Delimiter to use for inline arrays and tabular rows.
   * Defaults to comma.
   */
  delimiter?: ',' | '|' | '\t';
  /**
   * When true, object keys are sorted alphabetically to keep output deterministic.
   * Defaults to false (preserve encounter order).
   */
  sortKeys?: boolean;
}

export interface ToonToJsonOptions extends SecurityOptions {
  /**
   * Enforce declared array lengths, field counts, and indentation consistency.
   * Defaults to true.
   */
  strict?: boolean;
}

type Container =
  | { type: 'object'; value: Record<string, unknown>; indent: number }
  | {
      type: 'list';
      value: unknown[];
      indent: number;
      expectedLength: number | null;
      delimiter: Delimiter;
    }
  | {
      type: 'tabular';
      value: Record<string, unknown>[];
      indent: number;
      expectedLength: number;
      delimiter: Delimiter;
      fields: string[];
    }
  | {
      type: 'placeholder';
      indent: number;
      filled: boolean;
      assign: (value: unknown) => void;
    };

type Delimiter = ',' | '|' | '\t';

interface Limits {
  maxDepth: number;
  maxArrayLength: number;
  maxTotalNodes: number;
  disallowedKeys: string[];
}

const DEFAULT_LIMITS: Limits = Object.freeze({
  maxDepth: 64,
  maxArrayLength: 50_000,
  maxTotalNodes: 250_000,
  disallowedKeys: ['__proto__', 'constructor', 'prototype']
});

const DEFAULT_DELIMITER: Delimiter = ',';
const NUMERIC_RE = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/;
const NUMERIC_LIKE_RE = /^-?\d+(?:\.\d+)?(?:e[+-]?\d+)?$/i;
const LEADING_ZERO_RE = /^0\d+$/;
const SAFE_KEY_RE = /^[A-Za-z_][A-Za-z0-9_.]*$/;

export class ToonError extends Error {
  public readonly line?: number;

  constructor(message: string, line?: number) {
    super(line ? `Line ${line}: ${message}` : message);
    this.name = 'ToonError';
    this.line = line;
  }
}

export function jsonToToon(value: unknown, options: JsonToToonOptions = {}): string {
  const indentSize = options.indent ?? 2;
  if (!Number.isInteger(indentSize) || indentSize <= 0) {
    throw new ToonError('Indent must be a positive integer.');
  }
  const delimiter: Delimiter = options.delimiter ?? DEFAULT_DELIMITER;
  const limits = applyLimits(options);
  const state = { nodes: 0 };
  const lines: string[] = [];
  const indentUnit = ' '.repeat(indentSize);

  const encodeValue = (input: unknown, depth: number, key: string | null, activeDelimiter: Delimiter): void => {
    enforceLimits(depth, limits, state);
    if (isPrimitive(input)) {
      const line = primitiveLine(key, input, indentUnit.repeat(depth), activeDelimiter, limits);
      lines.push(line);
      return;
    }

    if (Array.isArray(input)) {
      encodeArray(key, input, depth, activeDelimiter);
      return;
    }

    if (isPlainObject(input)) {
      encodeObject(key, input as Record<string, unknown>, depth, activeDelimiter);
      return;
    }

    throw new ToonError(`Unsupported value type: ${typeof input}`);
  };

  const encodeObject = (
    key: string | null,
    obj: Record<string, unknown>,
    depth: number,
    activeDelimiter: Delimiter
  ): void => {
    enforceLimits(depth, limits, state);
    const entries = Object.entries(obj);
    const sortedEntries = options.sortKeys ? [...entries].sort(([a], [b]) => a.localeCompare(b)) : entries;
    const prefix = indentUnit.repeat(depth);

    if (key !== null) {
      validateKeySafety(key, limits);
      if (sortedEntries.length === 0) {
        lines.push(`${prefix}${encodeKey(key, activeDelimiter)}:`);
        return;
      }
      lines.push(`${prefix}${encodeKey(key, activeDelimiter)}:`);
    } else if (depth > 0 && sortedEntries.length === 0) {
      // empty anonymous object
      return;
    }

    for (const [childKey, childValue] of sortedEntries) {
      const nextDepth = key === null ? depth : depth + 1;
      enforceLimits(nextDepth, limits, state);
      encodeValue(childValue, nextDepth, childKey, activeDelimiter);
    }
  };

  const encodeArray = (key: string | null, arr: unknown[], depth: number, activeDelimiter: Delimiter): void => {
    enforceLimits(depth, limits, state);
    if (key !== null) {
      validateKeySafety(key, limits);
    }
    if (arr.length > limits.maxArrayLength) {
      throw new ToonError(`Array length ${arr.length} exceeds limit ${limits.maxArrayLength}.`);
    }

    const prefix = indentUnit.repeat(depth);
    const headerKey = key === null ? '' : encodeKey(key, activeDelimiter);

    if (arr.every(isPrimitive)) {
      const encoded = arr.map(v => encodePrimitive(v as JsonPrimitive, activeDelimiter, activeDelimiter)).join(activeDelimiter);
      const spacing = arr.length > 0 ? ' ' : '';
      lines.push(`${prefix}${headerKey}[${arr.length}]:${spacing}${encoded}`);
      bumpNodes(state, limits, arr.length);
      return;
    }

    const tabular = detectTabular(arr);
    if (tabular) {
      const { fields, rows } = tabular;
      const encodedFields = fields.map(f => encodeKey(f, activeDelimiter)).join(activeDelimiter);
      lines.push(`${prefix}${headerKey}[${arr.length}]{${encodedFields}}:`);
      for (const row of rows) {
        const rowValues = fields
          .map(f => encodePrimitive(row[f] as JsonPrimitive, activeDelimiter, activeDelimiter))
          .join(activeDelimiter);
        lines.push(`${indentUnit.repeat(depth + 1)}${rowValues}`);
      }
      bumpNodes(state, limits, arr.length * fields.length);
      return;
    }

    // expanded list
    lines.push(`${prefix}${headerKey}[${arr.length}]:`);
    const itemIndent = depth + 1;
    const itemPrefix = indentUnit.repeat(itemIndent);
    for (const item of arr) {
      enforceLimits(itemIndent, limits, state);
      if (isPrimitive(item)) {
        lines.push(`${itemPrefix}- ${encodePrimitive(item, activeDelimiter, activeDelimiter)}`);
        bumpNodes(state, limits, 1);
      } else if (Array.isArray(item)) {
        const inline = item.every(isPrimitive);
        if (inline) {
          const encoded = item.map(v => encodePrimitive(v as JsonPrimitive, activeDelimiter, activeDelimiter)).join(activeDelimiter);
          const spacing = item.length > 0 ? ' ' : '';
          lines.push(`${itemPrefix}- [${item.length}]:${spacing}${encoded}`);
          bumpNodes(state, limits, item.length);
        } else {
          lines.push(`${itemPrefix}-`);
          encodeArray(null, item, itemIndent + 1, activeDelimiter);
        }
      } else if (isPlainObject(item)) {
        const objEntries = Object.entries(item as Record<string, unknown>);
        if (objEntries.length === 0) {
          lines.push(`${itemPrefix}-`);
          continue;
        }
        lines.push(`${itemPrefix}-`);
        for (const [childKey, childValue] of objEntries) {
          encodeValue(childValue, itemIndent + 1, childKey, activeDelimiter);
        }
      } else {
        throw new ToonError(`Unsupported array item type: ${typeof item}`);
      }
    }
  };

  encodeValue(value, 0, null, delimiter);
  return lines.join('\n');
}

export function toonToJson(text: string, options: ToonToJsonOptions = {}): unknown {
  const limits = applyLimits(options);
  const strict = options.strict ?? true;
  const delimiterFallback: Delimiter = DEFAULT_DELIMITER;
  const lines = text.split(/\r?\n/);
  const contexts: Container[] = [];
  let rootContainer: Extract<Container, { type: 'object' }> | null = null;
  let indentStep: number | null = null;
  let root: unknown | null = null;
  const state = { nodes: 0 };

  const finalizeContainer = (container: Container, lineNo: number): void => {
    if (container.type === 'tabular') {
      if (strict && container.value.length !== container.expectedLength) {
        throw new ToonError(
          `Tabular array length mismatch: expected ${container.expectedLength}, got ${container.value.length}.`,
          lineNo
        );
      }
    } else if (container.type === 'list') {
      if (strict && container.expectedLength !== null && container.value.length !== container.expectedLength) {
        throw new ToonError(
          `List length mismatch: expected ${container.expectedLength}, got ${container.value.length}.`,
          lineNo
        );
      }
    } else if (container.type === 'placeholder') {
      if (strict && !container.filled) {
        throw new ToonError('List item is empty where a value was expected.', lineNo);
      }
    }
  };

  const attachValue = (
    value: unknown,
    parent: Container | undefined,
    key: string | null,
    lineNo?: number
  ): void => {
    const ensureRootObject = (): Extract<Container, { type: 'object' }> => {
      if (rootContainer) {
        return rootContainer;
      }
      const obj: Extract<Container, { type: 'object' }> = { type: 'object', value: createSafeObject(), indent: 0 };
      rootContainer = obj;
      root = obj.value;
      contexts.push(obj);
      return obj;
    };

    if (!parent) {
      if (key !== null) {
        const target = ensureRootObject();
        target.value[key] = value;
        return;
      }
      if (root !== null) {
        throw new ToonError('Multiple root values detected.', lineNo);
      }
      root = value;
      return;
    }
    if (parent.type === 'object') {
      if (key === null) {
        throw new ToonError('Missing key for object assignment.');
      }
      parent.value[key] = value;
      return;
    }
    if (parent.type === 'list') {
      parent.value.push(value);
      return;
    }
    if (parent.type === 'placeholder') {
      if (parent.filled) {
        throw new ToonError('List item already filled.', lineNo);
      }
      parent.assign(value);
      parent.filled = true;
      return;
    }
    throw new ToonError('Invalid parent container.');
  };

  const parseArrayHeader = (token: string, lineNo: number): { length: number; delimiter: Delimiter; fields?: string[] } => {
    const match = token.match(/^\[(\d+)([,\|\t])?\](\{(.+)\})?$/);
    if (!match) {
      throw new ToonError(`Invalid array header "${token}".`, lineNo);
    }
    const length = parseInt(match[1]!, 10);
    if (!Number.isFinite(length)) {
      throw new ToonError('Invalid array length.', lineNo);
    }
    const delimiter = (match[2] as Delimiter | undefined) ?? delimiterFallback;
    const fieldsRaw = match[4];
    if (fieldsRaw === undefined) {
      return { length, delimiter };
    }
    const fields = splitDelimited(fieldsRaw, delimiter, lineNo).map(f => decodeKey(f, delimiter, lineNo));
    if (fields.length === 0 && strict) {
      throw new ToonError('Tabular arrays require at least one field.', lineNo);
    }
    return { length, delimiter, fields };
  };

  const processKeyValueLine = (
    indentLevel: number,
    keyToken: string,
    valueToken: string,
    lineNo: number,
    parent: Container | undefined
  ): void => {
    const { rawKey, header } = splitKeyHeader(keyToken);
    const key = rawKey === '' ? null : decodeKey(rawKey, delimiterFallback, lineNo);
    if (key !== null) {
      validateKeySafety(key, limits, lineNo);
    }

    if (header) {
      const { length, delimiter, fields } = parseArrayHeader(header, lineNo);
      if (length > limits.maxArrayLength) {
        throw new ToonError(`Array length ${length} exceeds limit ${limits.maxArrayLength}.`, lineNo);
      }
      if (fields) {
        if (valueToken !== '') {
          throw new ToonError('Tabular array header must not have inline values.', lineNo);
        }
        const arr: Record<string, unknown>[] = [];
        bumpNodes(state, limits, 1, lineNo);
        attachValue(arr, parent, key, lineNo);
        contexts.push({
          type: 'tabular',
          value: arr,
          indent: indentLevel + 1,
          expectedLength: length,
          delimiter,
          fields
        });
        return;
      }

      if (valueToken === '') {
        const arr: unknown[] = [];
        bumpNodes(state, limits, 1, lineNo);
        attachValue(arr, parent, key, lineNo);
        contexts.push({
          type: 'list',
          value: arr,
          indent: indentLevel + 1,
          expectedLength: length,
          delimiter
        });
        return;
      }

      const values = splitDelimited(valueToken, delimiter, lineNo).map(t => parsePrimitiveToken(t, delimiter, lineNo, strict));
      if (strict && values.length !== length) {
        throw new ToonError(`Inline array length mismatch: expected ${length}, got ${values.length}.`, lineNo);
      }
      attachValue(values, parent, key, lineNo);
      bumpNodes(state, limits, values.length, lineNo);
      return;
    }

    if (valueToken === '') {
      const obj: Record<string, unknown> = createSafeObject();
      attachValue(obj, parent, key, lineNo);
      contexts.push({ type: 'object', value: obj, indent: indentLevel + 1 });
      return;
    }

    const value = parsePrimitiveToken(valueToken, delimiterFallback, lineNo, strict);
    attachValue(value, parent, key, lineNo);
    bumpNodes(state, limits, 1, lineNo);
  };

  lines.forEach((rawLine, index) => {
    const lineNo = index + 1;
    const trimmedEnd = rawLine.replace(/[ \t]+$/, '');
    if (trimmedEnd.trim() === '') {
      return; // skip blank lines
    }
    const indentSpaces = countLeadingSpaces(trimmedEnd, lineNo);
    if (indentStep === null) {
      indentStep = indentSpaces === 0 ? 2 : indentSpaces;
    }
    if (indentSpaces % indentStep !== 0) {
      throw new ToonError(`Inconsistent indentation: expected multiples of ${indentStep} spaces.`, lineNo);
    }
    const indentLevel = indentSpaces / indentStep;
    if (indentLevel > limits.maxDepth) {
      throw new ToonError(`Maximum depth ${limits.maxDepth} exceeded.`, lineNo);
    }
    const line = trimmedEnd.slice(indentSpaces);

    while (true) {
      const top = contexts[contexts.length - 1];
      if (!top || indentLevel >= top.indent) {
        break;
      }
      contexts.pop();
      finalizeContainer(top, lineNo);
    }

    // tabular row disambiguation
    let handled = false;
    let consumed = false;
    while (!handled) {
      const top = contexts[contexts.length - 1];
      if (top && top.type === 'tabular' && indentLevel === top.indent) {
        const classification = classifyTabularLine(line, top.delimiter);
        if (classification === 'row') {
          const cells = splitDelimited(line, top.delimiter, lineNo);
          if (strict && cells.length !== top.fields.length) {
            throw new ToonError(
              `Tabular row width mismatch: expected ${top.fields.length}, got ${cells.length}.`,
              lineNo
            );
          }
          const obj: Record<string, unknown> = createSafeObject();
          top.fields.forEach((field, idx) => {
            validateKeySafety(field, limits, lineNo);
            const token = cells[idx] ?? '';
            obj[field] = parsePrimitiveToken(token, top.delimiter, lineNo, strict);
            bumpNodes(state, limits, 1, lineNo);
          });
          top.value.push(obj);
          if (top.value.length > limits.maxArrayLength) {
            throw new ToonError(
              `Tabular array length exceeds limit ${limits.maxArrayLength}.`,
              lineNo
            );
          }
          handled = true;
          consumed = true;
          break;
        }
        finalizeContainer(top, lineNo);
        contexts.pop();
        continue;
      }
      handled = true;
    }
    if (consumed) {
      return;
    }

    const parent = contexts[contexts.length - 1];

    if (parent && parent.type === 'list') {
      if (indentLevel !== parent.indent) {
        throw new ToonError('List items must align under their header.', lineNo);
      }
      parseListItem(line, parent, indentLevel, lineNo, processKeyValueLine, contexts, state, limits, strict);
      return;
    }

    if (parent && parent.type === 'placeholder') {
      if (indentLevel !== parent.indent) {
        throw new ToonError('List item body must indent one level below "-".', lineNo);
      }
      // allow body to be parsed as if parent were absent; attachValue will route through placeholder.
    }

    if (indentLevel !== (parent ? parent.indent : 0)) {
      throw new ToonError('Unexpected indentation level.', lineNo);
    }

    const colonIndex = findUnquotedColon(line);
    if (colonIndex === -1) {
      // possible root primitive
      if (root === null && !parent) {
        const value = parsePrimitiveToken(line.trim(), delimiterFallback, lineNo, strict);
        root = value;
        bumpNodes(state, limits, 1, lineNo);
        return;
      }
      throw new ToonError('Expected key-value pair.', lineNo);
    }

    const keyToken = line.slice(0, colonIndex).trim();
    const valueToken = line.slice(colonIndex + 1).trim();
    processKeyValueLine(indentLevel, keyToken, valueToken, lineNo, parent);
  });

  while (contexts.length > 0) {
    const container = contexts.pop() as Container;
    finalizeContainer(container, lines.length);
  }

  if (root === null) {
    return createSafeObject();
  }
  return root;
}

function classifyTabularLine(line: string, delimiter: Delimiter): 'row' | 'field' {
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

function parseListItem(
  line: string,
  list: Extract<Container, { type: 'list' }>,
  indentLevel: number,
  lineNo: number,
  processKeyValueLine: (
    indentLevel: number,
    keyToken: string,
    valueToken: string,
    lineNo: number,
    parent: Container | undefined
  ) => void,
  contexts: Container[],
  state: { nodes: number },
  limits: Limits,
  strict: boolean
): void {
  const trimmed = line.trim();
  if (!trimmed.startsWith('-')) {
    throw new ToonError('List items must start with "-".', lineNo);
  }
  const content = trimmed.slice(1).trim();
  if (content === '') {
    const placeholder: Container = {
      type: 'placeholder',
      indent: indentLevel + 1,
      filled: false,
      assign: value => {
        list.value.push(value);
      }
    };
    contexts.push(placeholder);
    return;
  }

  // Array list item (header on the same line)
  if (content.startsWith('[')) {
    const colonIndex = findUnquotedColon(content);
    const headerToken = colonIndex === -1 ? content : content.slice(0, colonIndex).trim();
    const valueToken = colonIndex === -1 ? '' : content.slice(colonIndex + 1).trim();
    const { length, delimiter, fields } = parseArrayHeaderFromList(headerToken, lineNo);
    if (length > limits.maxArrayLength) {
      throw new ToonError(`Array length ${length} exceeds limit ${limits.maxArrayLength}.`, lineNo);
    }
    if (fields) {
      if (valueToken !== '') {
        throw new ToonError('Tabular header in list item cannot have inline values.', lineNo);
      }
      const arr: Record<string, unknown>[] = [];
      bumpNodes(state, limits, 1, lineNo);
      list.value.push(arr);
      contexts.push({
        type: 'tabular',
        value: arr,
        indent: indentLevel + 1,
        expectedLength: length,
        delimiter,
        fields
      });
      return;
    }

    if (valueToken === '') {
      const arr: unknown[] = [];
      bumpNodes(state, limits, 1, lineNo);
      list.value.push(arr);
      contexts.push({
        type: 'list',
        value: arr,
        indent: indentLevel + 1,
        expectedLength: length,
        delimiter
      });
      return;
    }

    const values = splitDelimited(valueToken, delimiter, lineNo).map(t => parsePrimitiveToken(t, delimiter, lineNo, strict));
    if (strict && values.length !== length) {
      throw new ToonError(`Inline array length mismatch: expected ${length}, got ${values.length}.`, lineNo);
    }
    bumpNodes(state, limits, values.length, lineNo);
    list.value.push(values);
    return;
  }

  // Inline object field or array header
  const colonIndex = findUnquotedColon(content);
  if (colonIndex !== -1) {
    const keyToken = content.slice(0, colonIndex).trim();
    const valueToken = content.slice(colonIndex + 1).trim();
    const obj = createSafeObject();
    bumpNodes(state, limits, 1, lineNo);
    list.value.push(obj);
    const objContext: Container = { type: 'object', value: obj, indent: indentLevel + 1 };
    contexts.push(objContext);
    processKeyValueLine(indentLevel + 1, keyToken, valueToken, lineNo, objContext);
    return;
  }

  // Primitive value
  const value = parsePrimitiveToken(content, list.delimiter, lineNo, strict);
  bumpNodes(state, limits, 1, lineNo);
  list.value.push(value);
}

function splitKeyHeader(token: string): { rawKey: string; header?: string } {
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

function parseArrayHeaderFromList(token: string, lineNo: number): { length: number; delimiter: Delimiter; fields?: string[] } {
  const match = token.match(/^\[(\d+)([,\|\t])?\](\{(.+)\})?$/);
  if (!match) {
    throw new ToonError(`Invalid array header "${token}".`, lineNo);
  }
  const length = parseInt(match[1]!, 10);
  const delimiter = (match[2] as Delimiter | undefined) ?? DEFAULT_DELIMITER;
  const fieldsRaw = match[4];
  const fields = fieldsRaw ? splitDelimited(fieldsRaw, delimiter, lineNo).map(f => decodeKey(f, delimiter, lineNo)) : undefined;
  return { length, delimiter, fields };
}

function findUnquotedColon(text: string): number {
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

function countLeadingSpaces(text: string, lineNo: number): number {
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

function parsePrimitiveToken(token: string, delimiter: Delimiter, lineNo: number, strict: boolean): JsonPrimitive {
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
  if (/^-?0\d+/.test(trimmed)) {
    throw new ToonError('Numbers with leading zeros must be quoted.', lineNo);
  }
  if (NUMERIC_RE.test(trimmed)) {
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

function decodeQuotedString(token: string, lineNo: number): string {
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

function splitDelimited(text: string, delimiter: Delimiter, lineNo: number): string[] {
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

function encodePrimitive(value: JsonPrimitive, activeDelimiter: Delimiter, documentDelimiter: Delimiter): string {
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

function encodeString(value: string, activeDelimiter: Delimiter, documentDelimiter: Delimiter): string {
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

function escapeString(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t');
}

function primitiveLine(
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

function encodeKey(key: string, activeDelimiter: Delimiter): string {
  if (SAFE_KEY_RE.test(key) && !key.includes(activeDelimiter)) {
    return key;
  }
  return `"${escapeString(key)}"`;
}

function decodeKey(token: string, delimiter: Delimiter, lineNo: number): string {
  const trimmed = token.trim();
  if (trimmed.startsWith('"')) {
    return decodeQuotedString(trimmed, lineNo);
  }
  if (!SAFE_KEY_RE.test(trimmed)) {
    throw new ToonError('Invalid key token.', lineNo);
  }
  if (trimmed.includes(delimiter)) {
    throw new ToonError('Key contains active delimiter and must be quoted.', lineNo);
  }
  return trimmed;
}

function bumpNodes(state: { nodes: number }, limits: Limits, count: number, lineNo?: number): void {
  state.nodes += count;
  if (state.nodes > limits.maxTotalNodes) {
    throw new ToonError(`Node count ${state.nodes} exceeds limit ${limits.maxTotalNodes}.`, lineNo);
  }
}

function enforceLimits(depth: number, limits: Limits, state: { nodes: number }): void {
  if (depth > limits.maxDepth) {
    throw new ToonError(`Maximum depth ${limits.maxDepth} exceeded.`);
  }
  bumpNodes(state, limits, 1);
}

function applyLimits(options: SecurityOptions): Limits {
  return {
    maxDepth: options.maxDepth ?? DEFAULT_LIMITS.maxDepth,
    maxArrayLength: options.maxArrayLength ?? DEFAULT_LIMITS.maxArrayLength,
    maxTotalNodes: options.maxTotalNodes ?? DEFAULT_LIMITS.maxTotalNodes,
    disallowedKeys: options.disallowedKeys ?? DEFAULT_LIMITS.disallowedKeys
  };
}

function isPrimitive(value: unknown): value is JsonPrimitive {
  return (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  );
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object') return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function detectTabular(arr: unknown[]): { fields: string[]; rows: Record<string, JsonPrimitive>[] } | null {
  if (arr.length === 0) return null;
  if (!arr.every(item => isPlainObject(item))) {
    return null;
  }
  const first = arr[0] as Record<string, unknown>;
  const fields = Object.keys(first);
  if (fields.length === 0) {
    return null;
  }
  const rows: Record<string, JsonPrimitive>[] = [];
  for (const item of arr) {
    const obj = item as Record<string, unknown>;
    const objKeys = Object.keys(obj);
    if (objKeys.length !== fields.length) return null;
    for (const field of fields) {
      if (!Object.prototype.hasOwnProperty.call(obj, field)) return null;
      if (!isPrimitive(obj[field])) return null;
    }
    rows.push(obj as Record<string, JsonPrimitive>);
  }
  return { fields, rows };
}

function validateKeySafety(key: string, limits: Limits = DEFAULT_LIMITS, lineNo?: number): void {
  if (limits.disallowedKeys.includes(key)) {
    throw new ToonError(`Disallowed key "${key}" to prevent prototype pollution.`, lineNo);
  }
}

function createSafeObject(): Record<string, unknown> {
  return Object.create(null);
}
