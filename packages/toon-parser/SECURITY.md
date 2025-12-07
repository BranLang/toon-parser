# Security Policy

## Supported Versions

Only the latest major version of `toon-parser` is currently supported with security updates.

| Version | Supported          |
| ------- | ------------------ |
| 2.x     | :white_check_mark: |
| 1.x     | :x:                |
| < 1.0   | :x:                |

## Reporting a Vulnerability

If you discover a security vulnerability within `toon-parser`, please do not open a public issue.
Instead, please email the maintainer directly or report it via GitHub Security Advisory if enabled for this repository.

We will acknowledge receipt of your vulnerability report within 48 hours and strive to send you regular updates about our progress.

## Release Integrity
- Builds are run in CI on Node 18 and 22.
- npm provenance is enabled (`npm publish --provenance`); verify signatures when consuming artifacts.

## Safe Configuration Guidance
- XML: keep the default `xmlOptions`; enabling entity expansion or custom parsers can alter security properties.
- HTML/CSV: apply input size limits at the caller boundary for untrusted data to avoid resource exhaustion.
- Use the latest patch/minor release on the 2.x line to receive security fixes.
