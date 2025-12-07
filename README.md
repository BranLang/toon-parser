# toon-parser

[![CI](https://github.com/BranLang/toon-parser/actions/workflows/ci.yml/badge.svg)](https://github.com/BranLang/toon-parser/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/toon-parser.svg)](https://www.npmjs.com/package/toon-parser)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Safe JSON ⇆ TOON encoder/decoder with strict validation and prototype-pollution guards.

## Install

```bash
npm install toon-parser
```

Note: this package supports both ESM and CommonJS consumers (CJS builds are available as `dist/index.cjs`). The package requires Node >= 18 per `engines` in `package.json`.

## New in 2.1.0
- **HTML/CSV/Log/URL Support**: Dedicated parsers for common formats to leverage Toon's structure.
- **Example Extensions**: Check `examples/extensions` for usage.


## Why this library?

- **Universal Data Support**: Converts JSON, XML, HTML, CSV, Logs, and URL parameters into TOON's concise, human-readable format.
- Implements TOON v2.1 spec features offering significant token savings: tabular arrays (perfect for CSV/Logs), inline primitive arrays, and deterministic quoting.
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
Parses logs. Options:
- `format`: `'auto'` | `'clf'` | `'json'`

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

## Project status

This library targets TOON spec v2.1 to serve as a universal bridge for structured data. It prioritizes correctness and safety over permissiveness; loosen validation via `strict: false` only when you fully trust the input source.

