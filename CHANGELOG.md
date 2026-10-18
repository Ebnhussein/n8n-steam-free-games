# Changelog

## 0.1.1 — 2026-10-18

- Replace the seven-day resend window with per-offer/status/deadline notification state.
- Allow a returning offer after two complete absent scans; do not resend for countdown, price, image, or reason-text changes.
- Read explicit per-app free-to-keep deadlines from Steam Store JSON and display Cairo time plus remaining duration.
- Add legacy SSH workflow code and a backed-up, syntax-checked metadata upgrade script.
- Add notification/expiry regression tests; no successful live claim is implied.

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
