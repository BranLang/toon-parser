# Security Policy

## Supported Versions

Only the latest minor on the current major line of `toon-parser` receives
security updates.

| Version | Supported          |
| ------- | ------------------ |
| 3.x     | :white_check_mark: |
| 2.x     | :x:                |
| < 2.0   | :x:                |

## Reporting a Vulnerability

If you discover a security vulnerability in `toon-parser`, **please do not open
a public issue**. Instead, use GitHub's private vulnerability reporting:

- https://github.com/BranLang/toon-parser/security/advisories/new

You can expect acknowledgement within 72 hours and regular progress updates
through the advisory thread.

## Release Integrity

- CI runs on Node **20, 22, 24** (see [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml)).
- npm provenance is enabled — releases are published with `npm publish --provenance --access public`.
- Verify provenance with `npm view toon-parser --json` (the `signatures` /
  `provenance` fields) or via `npm audit signatures`.

## Safe Configuration Guidance

The library enforces defense-in-depth limits by default. All `*ToToon` /
`*ToJson` decoders accept these options:

| Option                 | Default                                          | Purpose                                                              |
| ---------------------- | ------------------------------------------------ | -------------------------------------------------------------------- |
| `maxDepth`             | `64`                                             | Caps nested object/array depth.                                      |
| `maxArrayLength`       | `50_000`                                         | Caps any single array length.                                        |
| `maxTotalNodes`        | `250_000`                                        | Caps total values processed in one call.                             |
| `maxInputLength`       | `5_000_000` (5 MB)                               | Caps raw input string length. Use `Infinity` to disable.             |
| `disallowedKeys`       | `["__proto__", "constructor", "prototype"]`     | **Replaces** the prototype-pollution blocklist when set.             |
| `extraDisallowedKeys`  | `[]`                                             | **Adds** to the prototype-pollution blocklist. Prefer this for tenant guards. |

### Prototype pollution

The decoder rejects keys in `disallowedKeys` at every nesting level, including
URL bracket / dotted paths (`urlToToon`) and folded dotted-path keys
(`expandPaths: 'safe'`).

> **Footgun:** setting `disallowedKeys: ['tenantId']` **replaces** the default
> list, silently disabling the `__proto__` / `constructor` / `prototype` guards.
> Use `extraDisallowedKeys: ['tenantId']` instead to keep the defaults.

### Format adapters

- **XML** (`xmlToToon`): default `xmlOptions` disable XML declaration handling
  but rely on `fast-xml-parser`'s defaults for entities. Do not pass parser
  options that enable external entity resolution against untrusted input.
- **HTML** (`htmlToToon`): the validator uses linear scanners (no
  catastrophic-backtracking regex); still apply size limits at the caller
  boundary for untrusted input.
- **CSV** (`csvToToon`) and **Log** (`logToToon`): apply `maxInputLength` at the
  call site for untrusted input to bound parser work.
- **URL** (`urlToToon`): bracket and dotted segments are recursively checked
  against `disallowedKeys` before assignment.
