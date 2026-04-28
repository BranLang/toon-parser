// Shared primitive inference for side-format adapters (CSV, URL, ...).
// Strict: only matches plain integers/decimals (no hex, no leading zeros, no
// whitespace-only number coercion). Empty string stays empty string.

const NUMERIC_RE = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/;

export interface InferTypeOptions {
  /**
   * When `true`, the literal string `"null"` is decoded to the `null` value.
   * Defaults to `false` (kept as the literal string `"null"`) — most CSV/URL
   * sources mean the literal string when they emit `null`.
   */
  nullLiteral?: boolean;
}

export function inferType(
  value: string,
  options: InferTypeOptions = {}
): string | number | boolean | null {
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (options.nullLiteral && value === 'null') return null;
  if (value === '') return '';
  if (NUMERIC_RE.test(value)) {
    const num = Number(value);
    if (Number.isFinite(num)) return num;
  }
  return value;
}
