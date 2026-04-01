# Changelog

## [Unreleased]

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
