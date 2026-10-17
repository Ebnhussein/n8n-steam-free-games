# Changelog

## 0.1.0 — 2026-10-18

Initial experimental portable release.

### Added

- Standalone Node.js helper and private Docker Compose deployment.
- Local interactive Steam login with hidden password/Guard input and refresh-token storage.
- Steam Store discovery of discounted-free games and DLC with pagination.
- Free base-game dependency checks and ownership verification.
- Inactive-by-default n8n workflow with dry-run mode and Telegram photo/text notifications.
- Optional automatic-execution error notifications.
- Offline automated tests, GitHub Actions, English/Arabic setup guides, and troubleshooting.

### Validation

- Automated fixtures/mocks cover parsing, dependencies, ownership, API authentication, and concurrency.
- A successful live Steam license grant and the full portable deployment remain unverified.
- See [validation notes](docs/VALIDATION.md) before enabling claims.
