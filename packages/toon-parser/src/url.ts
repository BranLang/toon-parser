import { jsonToToon, JsonToToonOptions, ToonError, enforceInputLength } from './core.js';
import { inferType } from './inferType.js';

const DEFAULT_DISALLOWED = ['__proto__', 'constructor', 'prototype'] as const;

export function urlToToon(urlString: string, options: JsonToToonOptions = {}): string {
  enforceInputLength(urlString, options);
  let search = urlString;
  try {
    const u = new URL(urlString);
    search = u.search;
  } catch {
    const qIndex = urlString.indexOf('?');
    if (qIndex !== -1) {
      search = urlString.slice(qIndex);
    }
  }

  const params = new URLSearchParams(search);
  const root: Record<string, unknown> = Object.create(null);
  const base = options.disallowedKeys ?? DEFAULT_DISALLOWED;
  const disallowed = new Set<string>([...base, ...(options.extraDisallowedKeys ?? [])]);

  for (const [key, value] of params.entries()) {
    assignDeep(root, key, value, disallowed);
  }

  return jsonToToon(root, options);
}

function isArrayIndex(s: string): boolean {
  return /^(?:0|[1-9]\d*)$/.test(s);
}

function getChild(container: Record<string, unknown> | unknown[], key: string): unknown {
  if (Array.isArray(container)) {
    if (isArrayIndex(key)) return container[parseInt(key, 10)];
    return undefined;
  }
  return Object.prototype.hasOwnProperty.call(container, key) ? container[key] : undefined;
}

function setChild(
  container: Record<string, unknown> | unknown[],
  key: string,
  value: unknown
): void {
  if (Array.isArray(container)) {
    if (isArrayIndex(key)) {
      container[parseInt(key, 10)] = value;
    }
    return;
  }
  container[key] = value;
}

function assignDeep(
  root: Record<string, unknown>,
  rawKey: string,
  value: string,
  disallowed: ReadonlySet<string>
): void {
  // Recognize trailing "[]" as the push idiom (Rails/Express/PHP convention):
  //   tags[]=a&tags[]=b  -> { tags: ['a','b'] }
  let pushIdiom = false;
  let workingKey = rawKey;
  if (workingKey.endsWith('[]')) {
    pushIdiom = true;
    workingKey = workingKey.slice(0, -2);
  }

  // Split on `[`, `][`, `]`, or `.` — supports `a.b`, `a[b]`, `a[b][c]`.
  const parts = workingKey.split(/\[|\]\[|\]|\./).filter(Boolean);
  if (parts.length === 0) return;

  for (const part of parts) {
    if (disallowed.has(part)) {
      throw new ToonError(`Disallowed key "${part}" in URL parameter.`);
    }
  }

  let current: Record<string, unknown> | unknown[] = root;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i]!;
    const nextPart = parts[i + 1]!;
    const wantArrayChild = isArrayIndex(nextPart);
    const existing = getChild(current, part);

    if (existing === undefined || existing === null || typeof existing !== 'object') {
      const next: Record<string, unknown> | unknown[] = wantArrayChild
        ? []
        : (Object.create(null) as Record<string, unknown>);
      setChild(current, part, next);
      current = next;
    } else {
      current = existing as Record<string, unknown> | unknown[];
    }
  }

  const last = parts[parts.length - 1]!;
  const inferred = inferType(value);

  if (pushIdiom) {
    let arr = getChild(current, last);
    if (!Array.isArray(arr)) {
      arr = [];
      setChild(current, last, arr);
    }
    (arr as unknown[]).push(inferred);
    return;
  }

  setChild(current, last, inferred);
}
