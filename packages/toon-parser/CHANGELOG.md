# Changelog

## [2.0.0] - 2025-12-06

### Major Changes
- **XML Support**: Added `xmlToToon` function to parse XML strings directly to TOON. This introduces a new lightweight dependency `fast-xml-parser`.

### Added
- **SECURITY.md**: Added security policy.

## [1.1.3] - 2025-12-06

### Added
- **Date Support**: `jsonToToon` now automatically converts `Date` objects to their ISO string representation instead of throwing an "Unsupported value type" error.
