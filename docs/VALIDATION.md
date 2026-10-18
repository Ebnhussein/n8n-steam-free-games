# Validation status — 2026-10-18

This is a portable rewrite of a personal n8n/SSH experiment. It is not advertised as a proven unattended Steam claimer.

## Previously observed on the original installation

- Steam password + Mobile Guard login and Store cookies worked on an ARM64 Ubuntu server.
- Discount search found three free-to-keep DLCs, including names, images, and original prices.
- New Store forms supplied `subid` package IDs; the older `AddFreeLicense(...)` extraction alone missed them.
- Real claim attempts did not produce confirmed ownership. The account lacked all three paid base games.
- Telegram photo notifications were configured separately. These observations do not verify this rewrite end to end.

## Covered by this project's automated tests

- Search HTML parsing, entity decoding, original currency, and DLC inclusion.
- Rejection of paid cart forms, external license forms, ambiguous licenses, and temporary free play.
- No license POST in dry-run mode.
- A free base is processed before its DLC; unconfirmed base ownership blocks the DLC.
- App/package ownership confirms successful claims; authentication/ownership failures propagate.
- API authentication, explicit dryRun validation, and concurrency protection.
- Per-offer notification state, changed status/deadline updates, Cairo timezone formatting, unknown deadlines, and two-scan disappearance/reappearance.
- App-scoped expiry extraction from Steam JSON without borrowing another app's date.

Tests use synthetic fixtures and mocks. They do not contact a Steam account or grant licenses. The default imported workflow is inactive and dry-run enabled.

## Still requires integration validation

- Build/run Docker on Linux ARM64 and AMD64.
- Import both workflows into a real n8n instance and select credentials.
- Exercise interactive Steam login inside Docker, plus later refresh-token renewal.
- Confirm an actual giveaway grant for an eligible account.
- Confirm a free-base dependency followed by a DLC grant in a real account.
- Confirm Telegram photo delivery, retry behavior, and scheduled notification deduplication.
- Monitor discovery across regional availability, age restrictions, Store changes, and promotions not exposed in discounted search.

No claim is marked successful solely because an HTTP request returned 200 or redirected.
