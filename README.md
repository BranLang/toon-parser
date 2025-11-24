# json-toon-parser

Safe JSON ⇆ TOON encoder/decoder with strict validation and prototype-pollution guards.

## Install

```bash
npm install json-toon-parser
```

## Why this library?

- Implements the TOON v2.1 spec features most useful for JSON round-trips: tabular arrays, inline primitive arrays, nested objects/arrays, deterministic quoting.
- Hardened for untrusted input: prototype-pollution guards, max depth/length/node caps, strict length/width enforcement, and finite-number checks.
- No dynamic code execution; parsing uses explicit token scanning and bounded state to resist resource exhaustion.

## Quick start

```ts
import { jsonToToon, toonToJson } from 'json-toon-parser';

const data = {
  context: { task: 'hike planning', year: 2025 },
  friends: ['ana', 'luis', 'sam'],
  hikes: [
    { id: 1, name: 'Blue Lake', distanceKm: 7.5, wasSunny: true },
    { id: 2, name: 'Ridge Overlook', distanceKm: 9.2, wasSunny: false }
  ]
};

const toon = jsonToToon(data);
// TOON text with tabular hikes array and inline primitive friends array
console.log(toon);

const roundTrip = toonToJson(toon);
console.log(roundTrip); // back to the original JSON object
```

## API

### `jsonToToon(value, options?) => string`

Encodes a JSON-compatible value into TOON text.

Options:
- `indent` (number, default `2`): spaces per indentation level.
- `delimiter` (`,` | `|` | `\t`, default `,`): delimiter for inline arrays and tabular rows.
- `sortKeys` (boolean, default `false`): sort object keys alphabetically instead of preserving encounter order.
- `maxDepth` (number, default `64`): maximum nesting depth (objects + arrays).
- `maxArrayLength` (number, default `50_000`): maximum allowed array length.
- `maxTotalNodes` (number, default `250_000`): cap on processed fields/items to limit resource use.
- `disallowedKeys` (string[], default `["__proto__", "constructor", "prototype"]`): keys rejected to prevent prototype pollution.

Throws `ToonError` if limits are hit or input is not encodable.

### `toonToJson(text, options?) => unknown`

Decodes TOON text back to JSON data.

Options:
- `strict` (boolean, default `true`): enforce declared array lengths, tabular row widths, and indentation consistency.
- Same security options as `jsonToToon`: `maxDepth`, `maxArrayLength`, `maxTotalNodes`, `disallowedKeys`.

Throws `ToonError` with line numbers when parsing fails or security limits are exceeded.

## Usage examples

### Control indentation and delimiter

```ts
const toon = jsonToToon(data, { indent: 4, delimiter: '|' });
```

### Detect and emit tabular arrays

Uniform arrays of objects with primitive values are emitted in TOON’s table form automatically:

```ts
const toon = jsonToToon({ rows: [{ a: 1, b: 'x' }, { a: 2, b: 'y' }] });
/*
rows[2]{a,b}:
  1,x
  2,y
*/
```

Non-uniform arrays fall back to list form with `-` entries.

### Handling unsafe keys

Prototype-polluting keys are rejected:

```ts
toonToJson('__proto__: 1'); // throws ToonError: Disallowed key "__proto__"
```

You can extend the blocklist:

```ts
toonToJson('danger: 1', { disallowedKeys: ['danger'] }); // throws
```

### Enforcing strictness

Strict mode (default) ensures array lengths match headers and tabular rows match declared widths:

```ts
toonToJson('nums[2]: 1'); // throws ToonError: length mismatch
```

Disable strictness if you need best-effort parsing:

```ts
const result = toonToJson('nums[2]: 1', { strict: false });
// result: { nums: [1] }
```

### Security limits

```ts
const opts = { maxDepth: 10, maxArrayLength: 1000, maxTotalNodes: 10_000 };
jsonToToon(bigValue, opts); // throws if exceeded
toonToJson(bigToonText, opts); // throws if exceeded
```

## Error handling

All validation/parsing errors throw `ToonError`. When applicable, the error message includes a line number:

```ts
try {
  toonToJson('nums[2]: 1');
} catch (err) {
  if (err instanceof ToonError) {
    console.error(err.message); // "Line 1: Inline array length mismatch..."
  }
}
```

## Design choices

- **Tabular detection** follows the spec: all elements must be objects, share identical keys, and contain only primitives.
- **String quoting** follows deterministic rules (quote numeric-looking strings, leading/trailing space, colon, delimiter, backslash, brackets, control chars, or leading hyphen).
- **Finite numbers only**: `NaN`, `Infinity`, and `-Infinity` are rejected.
- **No implicit path expansion**: dotted keys stay literal (e.g., `a.b` remains a single key).

## Project status

This library targets TOON spec v2.1 core behaviors commonly needed for JSON round-trips. It prioritizes correctness and safety over permissiveness; loosen validation via `strict: false` only when you fully trust the input source.***
