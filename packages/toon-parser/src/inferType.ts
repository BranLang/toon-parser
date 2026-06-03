// Shared primitive inference for side-format adapters (CSV, URL, ...).
// Strict: only matches plain integers/decimals (no hex, no leading zeros, no
// whitespace-only number coercion). Empty string stays empty string.

const NUMERIC_RE = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/;

export function inferType(value: string): string | number | boolean {
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (value === '') return '';
  if (NUMERIC_RE.test(value)) {
    const num = Number(value);
    if (Number.isFinite(num)) return num;
  }
  return value;
}
