import { DEFAULT_LIMITS } from './constants.js';
import { ToonError } from './errors.js';
import type { JsonPrimitive, Limits } from './types.js';

export interface SecurityOptionsLike {
  maxDepth?: number;
  maxArrayLength?: number;
  maxTotalNodes?: number;
  disallowedKeys?: string[];
  extraDisallowedKeys?: string[];
  maxInputLength?: number;
}

export function applyLimits(options: SecurityOptionsLike): Limits {
  const base = options.disallowedKeys ?? DEFAULT_LIMITS.disallowedKeys;
  const extra = options.extraDisallowedKeys;
  const disallowed = extra && extra.length > 0
    ? Array.from(new Set([...base, ...extra]))
    : base;
  return {
    maxDepth: options.maxDepth ?? DEFAULT_LIMITS.maxDepth,
    maxArrayLength: options.maxArrayLength ?? DEFAULT_LIMITS.maxArrayLength,
    maxTotalNodes: options.maxTotalNodes ?? DEFAULT_LIMITS.maxTotalNodes,
    disallowedKeys: disallowed,
    maxInputLength: options.maxInputLength ?? DEFAULT_LIMITS.maxInputLength
  };
}

export function enforceInputLength(text: string, options: SecurityOptionsLike = {}): void {
  const cap = options.maxInputLength ?? DEFAULT_LIMITS.maxInputLength;
  if (text.length > cap) {
    throw new ToonError(`Input length ${text.length} exceeds limit ${cap}.`);
  }
}

export function bumpNodes(
  state: { nodes: number },
  limits: Limits,
  count: number,
  lineNo?: number
): void {
  state.nodes += count;
  if (state.nodes > limits.maxTotalNodes) {
    throw new ToonError(`Node count ${state.nodes} exceeds limit ${limits.maxTotalNodes}.`, lineNo);
  }
}

export function enforceLimits(depth: number, limits: Limits, state: { nodes: number }): void {
  if (depth > limits.maxDepth) {
    throw new ToonError(`Maximum depth ${limits.maxDepth} exceeded.`);
  }
  bumpNodes(state, limits, 1);
}

/**
 * Depth-only guard. Use this in encoder helpers that have already been
 * accounted for by their caller (e.g. `encodeArray`/`encodeObject` reached
 * via `encodeValue`, which already bumped a node).
 */
export function enforceDepth(depth: number, limits: Limits): void {
  if (depth > limits.maxDepth) {
    throw new ToonError(`Maximum depth ${limits.maxDepth} exceeded.`);
  }
}

export function validateKeySafety(key: string, limits: Limits = DEFAULT_LIMITS, lineNo?: number): void {
  if (limits.disallowedKeys.includes(key)) {
    throw new ToonError(`Disallowed key "${key}" to prevent prototype pollution.`, lineNo);
  }
}

export function createSafeObject(): Record<string, unknown> {
  return Object.create(null);
}

export function isPrimitive(value: unknown): value is JsonPrimitive {
  return (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  );
}

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object') return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

export function detectTabular(
  arr: unknown[]
): { fields: string[]; rows: Record<string, JsonPrimitive>[] } | null {
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
