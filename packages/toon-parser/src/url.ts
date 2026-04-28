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
  const obj: Record<string, unknown> = Object.create(null);
  const disallowed = new Set<string>(options.disallowedKeys ?? DEFAULT_DISALLOWED);

  for (const [key, value] of params.entries()) {
    assignDeep(obj, key, value, disallowed);
  }

  return jsonToToon(obj, options);
}

function assignDeep(
  obj: Record<string, unknown>,
  key: string,
  value: string,
  disallowed: ReadonlySet<string>
): void {
  // Split on `[`, `][`, `]`, or `.` — supports `a.b`, `a[b]`, `a[b][c]`.
  const parts = key.split(/\[|\]\[|\]|\./).filter(Boolean);
  if (parts.length === 0) return;

  for (const part of parts) {
    if (disallowed.has(part)) {
      throw new ToonError(`Disallowed key "${part}" in URL parameter.`);
    }
  }

  let current = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i]!;
    const existing = Object.prototype.hasOwnProperty.call(current, part) ? current[part] : undefined;
    if (existing === undefined || existing === null || typeof existing !== 'object') {
      const next: Record<string, unknown> = Object.create(null);
      current[part] = next;
      current = next;
    } else {
      current = existing as Record<string, unknown>;
    }
  }

  const last = parts[parts.length - 1]!;
  current[last] = inferType(value);
}

