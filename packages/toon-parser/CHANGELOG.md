# Changelog

## [Unreleased]

### Security
- Replaced regex-based HTML validation with a linear scan to remove potential ReDoS vectors.
- Added XML validation in `xmlToToon` and delimiter/row-width checks in CSV helpers for stricter input handling.

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
