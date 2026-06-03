import {
  DEFAULT_DELIMITER,
  IDENTIFIER_SEGMENT_RE
} from './internal/constants.js';
import { ToonError } from './internal/errors.js';
import {
  applyLimits,
  bumpNodes,
  createSafeObject,
  detectTabular,
  enforceDepth,
  enforceLimits,
  isPlainObject,
  isPrimitive,
  validateKeySafety
} from './internal/security.js';
import {
  classifyTabularLine,
  countLeadingSpaces,
  decodeKey,
  encodeKey,
  encodePrimitive,
  findUnquotedColon,
  parseArrayHeaderFromList,
  parsePrimitiveToken,
  primitiveLine,
  splitDelimited,
  splitKeyHeader
} from './internal/primitives.js';
import type {
  Container,
  Delimiter,
  JsonPrimitive,
  Limits
} from './internal/types.js';

export type { JsonPrimitive } from './internal/types.js';
export { ToonError } from './internal/errors.js';
export { enforceInputLength } from './internal/security.js';

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
   *
   * NOTE: Setting this **replaces** the default list. To keep the prototype
   * guards and add your own, prefer `extraDisallowedKeys`.
   */
  disallowedKeys?: string[];
  /**
   * Additional keys to reject, merged on top of the default prototype-pollution
   * guards (or your overridden `disallowedKeys`). Use this when you want to
   * extend — not replace — the blocklist.
   */
  extraDisallowedKeys?: string[];
  /**
   * Maximum allowed length of a raw input string passed to a `*ToToon` /
   * `*ToJson` decoder. Defaults to 5_000_000 (5 MB).
   * Set to `Infinity` to disable.
   */
  maxInputLength?: number;
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
  /**
   * TOON v3 §13.4 key folding. When `'safe'`, single-key object chains are folded
   * into dotted paths (e.g. `{a:{b:{c:1}}}` -> `a.b.c: 1`) provided every segment
   * matches the IdentifierSegment grammar. Defaults to `'off'`.
   */
  keyFolding?: 'off' | 'safe';
  /**
   * Maximum number of segments included in a folded path (counting from the
   * outermost key). Has no practical effect below 2. Defaults to Infinity when
   * `keyFolding` is `'safe'`.
   */
  flattenDepth?: number;
}

export interface ToonToJsonOptions extends SecurityOptions {
  /**
   * Enforce declared array lengths, field counts, and indentation consistency.
   * Defaults to true.
   */
  strict?: boolean;
  /**
   * TOON v3 §13.4 path expansion. When `'safe'`, dotted keys are expanded into
   * nested objects (e.g. `a.b.c: 1` -> `{a:{b:{c:1}}}`) provided every segment
   * matches the IdentifierSegment grammar. Defaults to `'off'`.
   */
  expandPaths?: 'off' | 'safe';
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
  const keyFolding = options.keyFolding ?? 'off';
  const flattenDepth = options.flattenDepth ?? Infinity;

  // TOON v3 §13.4: attempt to fold a single-key chain rooted at (firstKey -> firstValue).
  // Walks the maximal natural chain; verifies the natural endpoint qualifies (primitive,
  // array, Date, or empty plain object); then truncates to flattenDepth if needed.
  const tryFoldChain = (
    firstKey: string,
    firstValue: unknown,
    siblingKeys: ReadonlySet<string>
  ): { path: string; leaf: unknown } | null => {
    if (keyFolding !== 'safe') return null;
    if (!IDENTIFIER_SEGMENT_RE.test(firstKey)) return null;
    if (limits.disallowedKeys.includes(firstKey)) return null;

    const segments: string[] = [firstKey];
    const valuesAtEachStep: unknown[] = [firstValue];
    let current: unknown = firstValue;
    while (
      isPlainObject(current) &&
      Object.keys(current as Record<string, unknown>).length === 1
    ) {
      const onlyKey = Object.keys(current as Record<string, unknown>)[0]!;
      if (!IDENTIFIER_SEGMENT_RE.test(onlyKey)) break;
      if (limits.disallowedKeys.includes(onlyKey)) break;
      const nextValue = (current as Record<string, unknown>)[onlyKey];
      segments.push(onlyKey);
      valuesAtEachStep.push(nextValue);
      current = nextValue;
    }

    const endpointIsEmptyObject =
      isPlainObject(current) && Object.keys(current as Record<string, unknown>).length === 0;
    const endpointFoldable =
      isPrimitive(current) || Array.isArray(current) || current instanceof Date || endpointIsEmptyObject;
    if (!endpointFoldable) return null;
    if (segments.length < 2) return null;

    const cap = Math.max(2, Math.min(segments.length, flattenDepth));
    const usedSegments = segments.slice(0, cap);
    const leaf = valuesAtEachStep[cap - 1];

    const path = usedSegments.join('.');
    if (siblingKeys.has(path)) return null;
    return { path, leaf };
  };

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

    if (input instanceof Date) {
      const line = primitiveLine(key, input.toISOString(), indentUnit.repeat(depth), activeDelimiter, limits);
      lines.push(line);
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
    // Caller already bumped via encodeValue; just enforce depth.
    enforceDepth(depth, limits);
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
      return;
    }

    const siblingKeys: Set<string> = new Set(sortedEntries.map(([k]) => k));
    for (const [childKey, childValue] of sortedEntries) {
      const nextDepth = key === null ? depth : depth + 1;
      // No explicit bump here — encodeValue does it for the child.
      enforceDepth(nextDepth, limits);
      const folded = tryFoldChain(childKey, childValue, siblingKeys);
      if (folded) {
        encodeValue(folded.leaf, nextDepth, folded.path, activeDelimiter);
      } else {
        encodeValue(childValue, nextDepth, childKey, activeDelimiter);
      }
    }
  };

  const encodeArray = (key: string | null, arr: unknown[], depth: number, activeDelimiter: Delimiter): void => {
    // Caller already bumped via encodeValue (or for the rare nested non-inline
    // array case, via the loop's enforceLimits below).
    enforceDepth(depth, limits);
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

    lines.push(`${prefix}${headerKey}[${arr.length}]:`);
    const itemIndent = depth + 1;
    const itemPrefix = indentUnit.repeat(itemIndent);
    for (const item of arr) {
      enforceDepth(itemIndent, limits);
      if (isPrimitive(item)) {
        lines.push(`${itemPrefix}- ${encodePrimitive(item, activeDelimiter, activeDelimiter)}`);
        bumpNodes(state, limits, 1);
      } else if (Array.isArray(item)) {
        // Count the inner array container itself.
        bumpNodes(state, limits, 1);
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
        // Count the inner object container itself.
        bumpNodes(state, limits, 1);
        const objEntries = Object.entries(item as Record<string, unknown>);
        if (objEntries.length === 0) {
          lines.push(`${itemPrefix}-`);
          continue;
        }
        lines.push(`${itemPrefix}-`);
        for (const [childKey, childValue] of objEntries) {
          encodeValue(childValue, itemIndent + 1, childKey, activeDelimiter);
        }
      } else if (item instanceof Date) {
        lines.push(`${itemPrefix}- ${encodePrimitive(item.toISOString(), activeDelimiter, activeDelimiter)}`);
        bumpNodes(state, limits, 1);
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
  if (text.length > limits.maxInputLength) {
    throw new ToonError(`Input length ${text.length} exceeds limit ${limits.maxInputLength}.`);
  }
  const strict = options.strict ?? true;
  const expandPaths = options.expandPaths ?? 'off';
  const delimiterFallback: Delimiter = DEFAULT_DELIMITER;

  // TOON v3 §13.4: split a dotted key into IdentifierSegment-only segments.
  // Returns null if the key contains no dots OR any segment fails the IdentifierSegment check.
  // Throws when a segment is in `disallowedKeys` to prevent prototype-pollution bypass.
  const trySplitDottedKey = (key: string, lineNo?: number): string[] | null => {
    if (expandPaths !== 'safe') return null;
    if (!key.includes('.')) return null;
    const segments = key.split('.');
    for (const seg of segments) {
      if (!IDENTIFIER_SEGMENT_RE.test(seg)) return null;
      if (limits.disallowedKeys.includes(seg)) {
        throw new ToonError(
          `Disallowed key segment "${seg}" in expanded path "${key}".`,
          lineNo
        );
      }
    }
    return segments;
  };

  // TOON v3 §13.4 deep-merge semantics for path expansion. In strict mode any
  // type conflict throws; in non-strict mode the new value wins (LWW).
  const assignExpandedPath = (
    target: Record<string, unknown>,
    segments: string[],
    value: unknown,
    lineNo?: number
  ): void => {
    let cursor: Record<string, unknown> = target;
    for (let i = 0; i < segments.length - 1; i++) {
      const seg = segments[i]!;
      const existing = cursor[seg];
      if (existing === undefined) {
        const next = createSafeObject();
        cursor[seg] = next;
        cursor = next;
        continue;
      }
      if (isPlainObject(existing)) {
        cursor = existing as Record<string, unknown>;
        continue;
      }
      if (strict) {
        throw new ToonError(
          `Expansion conflict at path "${segments.slice(0, i + 1).join('.')}" (object vs primitive).`,
          lineNo
        );
      }
      const next = createSafeObject();
      cursor[seg] = next;
      cursor = next;
    }
    const leafKey = segments[segments.length - 1]!;
    const existing = cursor[leafKey];
    if (existing === undefined) {
      cursor[leafKey] = value;
      return;
    }
    if (isPlainObject(existing) && isPlainObject(value)) {
      Object.assign(existing as Record<string, unknown>, value as Record<string, unknown>);
      return;
    }
    if (strict) {
      throw new ToonError(`Expansion conflict at path "${segments.join('.')}".`, lineNo);
    }
    cursor[leafKey] = value;
  };

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
          throw new ToonError(`List length mismatch: expected ${container.expectedLength}, got ${container.value.length}.`, lineNo);
      }
    } else if (container.type === 'placeholder') {
      // Empty `-` items decode as empty objects (mirrors the encoder).
      if (!container.filled) {
        container.assign(createSafeObject());
        container.filled = true;
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
        const segments = trySplitDottedKey(key, lineNo);
        if (segments) {
          assignExpandedPath(target.value, segments, value, lineNo);
          return;
        }
        if (expandPaths === 'safe' && Object.prototype.hasOwnProperty.call(target.value, key)) {
          assignExpandedPath(target.value, [key], value, lineNo);
          return;
        }
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
      const segments = trySplitDottedKey(key, lineNo);
      if (segments) {
        assignExpandedPath(parent.value, segments, value, lineNo);
        return;
      }
      if (expandPaths === 'safe' && Object.prototype.hasOwnProperty.call(parent.value, key)) {
        assignExpandedPath(parent.value, [key], value, lineNo);
        return;
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
    const fields = splitDelimited(fieldsRaw, delimiter, lineNo).map(f => decodeKey(f, lineNo));
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
    const key = rawKey === '' ? null : decodeKey(rawKey, lineNo);
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
      return;
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
    }

    if (indentLevel !== (parent ? parent.indent : 0)) {
      throw new ToonError('Unexpected indentation level.', lineNo);
    }

    const colonIndex = findUnquotedColon(line);
    if (colonIndex === -1) {
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
    if (parent && parent.type === 'placeholder') {
      // Placeholder body: route into the placeholder's tracked object so
      // subsequent body lines build the same record.
      if (!keyToken.startsWith('[')) {
        if (!parent.current) {
          const obj = createSafeObject();
          parent.assign(obj);
          parent.current = { value: obj, indent: indentLevel + 1 };
          parent.filled = true;
        }
        const objContext: Container = { type: 'object', value: parent.current.value, indent: indentLevel + 1 };
        processKeyValueLine(indentLevel, keyToken, valueToken, lineNo, objContext);
        return;
      }
    }
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
    const placeholder: Container & { type: 'placeholder' } = {
      type: 'placeholder',
      indent: indentLevel + 1,
      filled: false,
      current: undefined,
      assign: function(value: unknown) {
        // Skip the empty-object follow-up that finalizeContainer pushes when a
        // placeholder body has already produced its real object.
        if (this.current && typeof value === 'object' && value !== null && !Array.isArray(value) && Object.keys(value).length === 0) {
          return;
        }
        list.value.push(value);
      }
    };
    contexts.push(placeholder);
    return;
  }

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

  const value = parsePrimitiveToken(content, list.delimiter, lineNo, strict);
  bumpNodes(state, limits, 1, lineNo);
  list.value.push(value);
}
