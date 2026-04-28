# Changelog

## [Unreleased]

## [3.0.0] - 2026-04-28

This release aligns the library with the **TOON v3.0** specification (Working Draft, 2025-11-24)
and bundles a security audit pass. Existing v2.x output and parsing behavior is preserved —
new features are opt-in.

### Security
- **Fix (high)**: prototype pollution in `urlToToon`. Bracketed/dotted query parameters with
  `__proto__`, `constructor`, or `prototype` segments could mutate `Object.prototype` via the
  intermediate-object walk in `assignDeep`. Path walking now uses `Object.create(null)`,
  `hasOwnProperty` lookups, and rejects any segment in `disallowedKeys` with `ToonError`.
- New `maxInputLength` security option (default 5 MB) on every `*ToToon` / `*ToJson` /
  `toonToJson` entry point caps raw input size before parsing. Pass `Infinity` to disable.
- Side-format adapters (`csvToToon`, `xmlToToon`, `htmlToToon`, `logToToon`, `urlToToon`)
  now throw `ToonError` instead of plain `Error` so `instanceof ToonError` works uniformly.

### Added
- **TOON v3.0 alignment**: opt-in **§13.4 key folding** (encoder) and **path expansion** (decoder).
  - `jsonToToon(value, { keyFolding: 'safe', flattenDepth?: number })` folds single-key object chains into dotted paths (`{a:{b:{c:1}}}` → `a.b.c: 1`).
  - `toonToJson(text, { expandPaths: 'safe' })` expands dotted keys back into nested objects, with deep-merge and strict-mode conflict detection.
  - All segments must satisfy the v3 IdentifierSegment grammar (`^[A-Za-z_][A-Za-z0-9_]*$`); folding/expansion refuses to bridge `disallowedKeys` (prototype-pollution guard).
- **Sub-path exports** — `toon-parser/csv`, `toon-parser/xml`, `toon-parser/html`, `toon-parser/log`, `toon-parser/url`. Adapters now import from a slim `core.ts` so importing `toon-parser/csv` no longer drags in xml/html/log/url. Both ESM and CJS conditions are wired.
- **Bench suite** — `npm run bench` runs Vitest benchmarks comparing encoder/decoder against `JSON.stringify`/`JSON.parse` and tracks key folding overhead.
- New tests: `v3.keyfolding.test.ts`, `url.security.test.ts`, `maxInputLength.test.ts`, `parser.errorpaths.test.ts`, `subpath.test.ts`.
- Exported `enforceInputLength(text, options?)` helper for downstream packages that wrap
  TOON inputs.

### Changed
- Project now targets TOON spec v3.0 (was v2.1). No breaking changes to existing inputs/outputs — v3 additions are opt-in.
- Extracted shared `inferType` helper (`src/inferType.ts`) for CSV/URL adapters; tightened
  number detection (now matches the strict numeric grammar — no hex coercion, no
  whitespace-only `0`, no leading-zero numbers).
- Refactored the 1180-line `index.ts` into a slim barrel + `core.ts` + `internal/` modules (`constants`, `errors`, `types`, `security`, `primitives`). Public API surface is unchanged.
- **`logToToon`**: now parses **Combined Log Format** (referer + user-agent) in addition to Common. `format` option accepts `'combined'` and `'auto'` tries Combined first, then Common. New fields: `ident`, `authuser`, and `referer`/`userAgent` for Combined. `size` is `null` (was `0`) when the log emits `-`. The previous single-shot CLF regex hardcoded `- -` for ident/authuser; existing valid CLF inputs still parse — emitted field sets are wider.
- **`maxTotalNodes` accounting** is now ~2× tighter for nested objects/arrays. The previous accounting double-counted via redundant `enforceLimits` calls; a new `enforceDepth` helper does pure depth checks where the caller has already accounted for the node. The default `250_000` budget now permits roughly twice as many real fields/items as before.
- Examples now run as part of CI (`npm run smoke`) so adapter regressions are caught before publish.
- Workspace `lint` script migrated to ESLint 9 flat config (`eslint.config.js`); the previous `--ext` flag (removed in ESLint 9) had broken `npm run lint -w toon-parser`.
- Dependency bumps: `fast-xml-parser` 5.5.9 → 5.7.2, `vitest` 4.1.2 → 4.1.5, `@vitest/coverage-v8` 4.1.2 → 4.1.5, `@typescript-eslint/*` 8.58 → 8.59, `fast-check` 4.6 → 4.7, `@types/node` 25.5 → 25.6, `esbuild` override 0.27.4 → 0.27.7.
- CI matrix now tests Node 20, 22, and 24.

## [2.2.0] - 2026-04-01

### Security
- Replaced regex-based HTML validation with a linear scan to remove potential ReDoS vectors.
- Added XML validation in `xmlToToon` and delimiter/row-width checks in CSV helpers for stricter input handling.
- Fixed 8 dependency vulnerabilities including critical `fast-xml-parser` CVEs (DoS via entity expansion, regex injection, stack overflow, numeric entity bypass).
- Updated `fast-xml-parser` from 5.3.2 to 5.5.9.

### Changed
- **Breaking**: Minimum Node.js version bumped from 18 to 20 (Node 18 reached EOL April 2025).
- Updated `vitest` from 2.x to 4.x, `typescript` from 5.6 to 5.9, `@types/node` from 24.x to 25.x.
- Updated `eslint` to 9.39, `@typescript-eslint/*` to 8.58, `fast-check` to 4.6, `rimraf` to 6.1.
- Updated `esbuild` override from 0.25 to 0.27.
- CI matrix now tests Node 20 and 22 (previously 18 and 22).

### Fixed
- Added `esbuild` as explicit devDependency (was previously a phantom transitive dependency).
- Excluded test files from published npm tarball (package size reduced from 43 kB to 35 kB).
- Fixed `repository.url` in package.json to use normalized `git+https://` format.
- Fixed vitest coverage config to use `thresholds` key (required by vitest 4).

### Tooling
- Added `npm run coverage` using Vitest coverage; CI now relies on this step without `nyc` to avoid missing output errors.
- Added provenance and test/coverage badges to README.

### Docs
- Documented `csvToJson`, `htmlToJson`, `xmlToJson` behaviors and limitations.
- Updated SECURITY policy with provenance and safe-configuration guidance.

## [2.1.0] - 2025-12-07

### Added
- **HTML Support**: New `htmlToToon` using `node-html-parser`.
- **CSV Support**: New `csvToToon` for converting CSV to tabular Toon arrays.
- **Log Support**: New `logToToon` to process CLF/JSON logs into efficient Toon structures.
- **URL Support**: New `urlToToon` to parse query strings and expand `key[subkey]` notations.

## [2.0.1] - 2025-12-06

### Security
- **CI/CD**: `npm audit` now fails on high/critical vulnerabilities.
- **Docs**: Added security warning regarding `xmlOptions` in README.

### Fixed
- **Build**: Fixed CJS build output not resolving internal modules correctly; switched to `esbuild`.
- **Types**: Fixed `package.json` exports order to prioritize types.

## [2.0.0] - 2025-12-06

### Major Changes
- **XML Support**: Added `xmlToToon` function to parse XML strings directly to TOON. This introduces a new lightweight dependency `fast-xml-parser`.

### Added
- **SECURITY.md**: Added security policy.

## [1.1.3] - 2025-12-06

### Added
- **Date Support**: `jsonToToon` now automatically converts `Date` objects to their ISO string representation instead of throwing an "Unsupported value type" error.
