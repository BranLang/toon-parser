import type { Delimiter, Limits } from './types.js';

export const NUMERIC_RE = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/;
export const NUMERIC_LIKE_RE = /^-?\d+(?:\.\d+)?(?:e[+-]?\d+)?$/i;
export const LEADING_ZERO_RE = /^0\d+$/;
export const SAFE_KEY_RE = /^[A-Za-z_][A-Za-z0-9_.]*$/;
// TOON v3 §1.9 IdentifierSegment: letters, digits, underscores; no dots; no leading digit.
export const IDENTIFIER_SEGMENT_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

export const DEFAULT_DELIMITER: Delimiter = ',';

export const DEFAULT_LIMITS: Limits = Object.freeze({
  maxDepth: 64,
  maxArrayLength: 50_000,
  maxTotalNodes: 250_000,
  disallowedKeys: ['__proto__', 'constructor', 'prototype'],
  maxInputLength: 5_000_000
});
