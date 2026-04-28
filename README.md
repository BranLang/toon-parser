# toon-parser

[![CI](https://github.com/BranLang/toon-parser/actions/workflows/ci.yml/badge.svg)](https://github.com/BranLang/toon-parser/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/toon-parser.svg)](https://www.npmjs.com/package/toon-parser)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Safe JSON ⇆ TOON encoder/decoder with strict validation and prototype-pollution guards.

## Install

```bash
npm install toon-parser
```

Note: this package supports both ESM and CommonJS consumers (CJS builds are available as `dist/index.cjs`). The package requires Node >= 20 per `engines` in `package.json`.

## New in 3.0.0
- **Aligned with TOON spec v3.0** (Working Draft, 2025-11-24). No breaking changes to existing input/output — v3 features are opt-in.
- **§13.4 key folding** (encoder) and **path expansion** (decoder). Single-key chains can collapse into dotted paths (`{a:{b:{c:1}}}` → `a.b.c: 1`) and round-trip back. See [Key folding & path expansion](#key-folding--path-expansion-toon-v3-§134) below.
- **Security**: fixed a prototype pollution vector in `urlToToon` (bracket/dotted `__proto__` / `constructor` / `prototype` segments now throw `ToonError` and never reach `Object.prototype`). New `maxInputLength` option (default 5 MB) caps raw input size on every parser entry point. All side-format adapters now throw `ToonError` (not plain `Error`).
- **Sub-path exports** — import only the adapter you need: `toon-parser/csv`, `toon-parser/xml`, `toon-parser/html`, `toon-parser/log`, `toon-parser/url`. Bundlers can now drop the unused adapters from your output.
- CI matrix now covers Node 20, 22, and 24.
- Routine dependency bumps (`fast-xml-parser` 5.7.2, `vitest` 4.1.5, `@typescript-eslint/*` 8.59, `fast-check` 4.7).

### Tree-shaking via sub-path imports

```ts
// Pulls in only the CSV adapter + the core encoder; xml/html/log/url stay out of the bundle.
import { csvToToon } from 'toon-parser/csv';

// The barrel still works — use this when you want everything.
import { jsonToToon, csvToToon, xmlToToon } from 'toon-parser';
```

## Why this library?

- **Universal Data Support**: Converts JSON, XML, HTML, CSV, Logs, and URL parameters into TOON's concise, human-readable format.
- Implements TOON v3.0 spec features offering significant token savings: tabular arrays (perfect for CSV/Logs), inline primitive arrays, deterministic quoting, and opt-in §13.4 key folding / path expansion.
- Hardened for untrusted input: prototype-pollution guards, max depth/length/node caps, strict length/width enforcement, and finite-number checks.
- No dynamic code execution; parsing uses explicit token scanning and bounded state to resist resource exhaustion.

## Quick start

```ts
import { jsonToToon, toonToJson } from 'toon-parser';

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

### `xmlToToon(xml, options?) => string`

Parses an XML string and converts it to TOON text.
Accepts standard `JsonToToonOptions` plus an `xmlOptions` object passed to `fast-xml-parser`.

```ts
import { xmlToToon } from 'toon-parser';
const toon = xmlToToon('<user id="1">Alice</user>');
// user:
//   "#text": Alice
//   "@_id": 1
```

### `htmlToToon(html, options?) => string`

Parses HTML string to Toon. Uses `node-html-parser`.

### `csvToToon(csv, options?) => string`

Parses CSV string. Options:
- `delimiter` (default `,`)
- `hasHeader` (default `true`)

### `urlToToon(urlOrQs, options?) => string`
Parses URL query strings to Toon object. Expands dotted/bracket notation (e.g. `user[name]`).

### `logToToon(log, options?) => string`
Parses logs into TOON tabular form. Options:
- `format`: `'auto'` | `'clf'` | `'combined'` | `'json'` (default `'auto'`)
  - `'auto'` tries Combined Log Format first (with referer + user-agent), falls back to Common Log Format, then to a `{ raw }` line on no match.
  - `'clf'` accepts both Common and Combined variants.
  - `'combined'` accepts only Combined Log Format.
  - `'json'` parses NDJSON (one JSON object per line); malformed lines become `{ raw }`.

Field set: `host`, `ident`, `authuser`, `date`, `request`, `status`, `size` (plus `referer`, `userAgent` for Combined). `size` is `null` when the log emits `-`.

> [!WARNING]
> **Security Note:** While `fast-xml-parser` v5 is generally secure by default, overriding `xmlOptions` can alter security properties (e.g., enabling entity expansion). Only enable such features if you trust the source XML.

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

### Converting external formats

Leverage specialized parsers to bring other data formats into the TOON ecosystem.

#### HTML
HTML is converted into a structured object tree, preserving attributes and hierarchy.

```ts
import { htmlToToon } from 'toon-parser';

const html = '<div class="card"><h3>Hello</h3></div>';
console.log(htmlToToon(html));
/*
div:
  "@_class": card
  h3: Hello
*/
```

#### CSV
CSV data is automatically optimized into TOON's efficient tabular format.

```ts
import { csvToToon } from 'toon-parser';

const csv = 'id,name\n1,Alice\n2,Bob';
console.log(csvToToon(csv));
/*
[2]{id,name}:
  1,Alice
  2,Bob
*/
```

#### URL Query Strings
Query strings with nested bracket notation are expanded into deep objects.

```ts
import { urlToToon } from 'toon-parser';

const url = 'filter[type]=user&filter[active]=true';
console.log(urlToToon(url));
/*
filter:
  type: user
  active: true
*/
```

#### Logs
Common Log Format (CLF) logs are parsed into tabular arrays for high efficiency.

```ts
import { logToToon } from 'toon-parser';

const log = '127.0.0.1 - - [10/Oct:12:00] "GET /" 200 512';
console.log(logToToon(log, { format: 'clf' }));
/*
[1]{host,ident,authuser,date,request,status,size}:
  127.0.0.1,-,-,"10/Oct:12:00",GET /,200,512
*/
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

- **Universal Tabular Support**: Detects tabular structures in JSON/CSV/Logs and optimizes them into compact TOON tables.
- **Format-Preserving**: HTML and XML conversions preserve hierarchy and attributes (as keys) while ensuring output remains safe TOON.
- **Deterministic Quoting**: String quoting follows strict rules to ensure round-trip safety.
- **Finite numbers only**: `NaN`, `Infinity`, and `-Infinity` are rejected.
- **Explicit pathing**: Dotted keys in JSON stay literal (`a.b` is one key), while URL parsers explicit expand standard bracket notation.

### Key folding & path expansion (TOON v3 §13.4)

Both are **opt-in** and default to `'off'`, so existing output and parsing behavior are unchanged.

**Encoder** — collapse single-key object chains into dotted paths:

```ts
jsonToToon({ a: { b: { c: 1 } } }, { keyFolding: 'safe' });
// "a.b.c: 1"

jsonToToon(
  { data: { meta: { items: [{ id: 1 }, { id: 2 }] } } },
  { keyFolding: 'safe' }
);
// data.meta.items[2]{id}:
//   1
//   2
```

Cap fold length with `flattenDepth` (defaults to `Infinity`):

```ts
jsonToToon({ a: { b: { c: { d: 1 } } } }, { keyFolding: 'safe', flattenDepth: 2 });
// a.b:
//   c.d: 1
```

A chain is foldable only when:
1. Every step is an object with exactly one key.
2. Every segment matches the IdentifierSegment grammar `^[A-Za-z_][A-Za-z0-9_]*$`.
3. The leaf is a primitive, array, `Date`, or empty object.
4. The folded path doesn't collide with a literal sibling.
5. No segment is in `disallowedKeys` (prototype-pollution guard).

**Decoder** — expand dotted keys into nested objects:

```ts
toonToJson('a.b.c: 1', { expandPaths: 'safe' });
// { a: { b: { c: 1 } } }

toonToJson(['a.b.c: 1', 'a.b.d: 2', 'a.e: 3'].join('\n'), { expandPaths: 'safe' });
// { a: { b: { c: 1, d: 2 }, e: 3 } }
```

Conflicting paths throw `ToonError` in strict mode (default), or last-write-wins when `strict: false`:

```ts
toonToJson('a.b: 1\na: 2', { expandPaths: 'safe' }); // throws — object vs primitive
toonToJson('a.b: 1\na: 2', { expandPaths: 'safe', strict: false }); // { a: 2 }
```

Disallowed segments (e.g. `__proto__`) cause `ToonError` regardless of `strict`.

## Project status

This library targets the **TOON v3.0** spec (Working Draft, 2025-11-24). All v2.1 features remain supported; v3 adopt-as-needed extensions (key folding, path expansion) are opt-in. The library prioritizes correctness and safety over permissiveness; loosen validation via `strict: false` only when you fully trust the input source.

