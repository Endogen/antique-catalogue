# Frontend review fixes — 2026-09-14

All four reported regressions were confirmed and fixed on top of the frontend improvements.

## Findings and repairs

- **Stale query results after writes:** creating a collection and adding a schema field succeeded on the server but were missing after return navigation. Successful API writes now invalidate affected lists, details, counts, search, stars, activity and public views. Reads, failed writes, archive previews and unfinished upload chunks do not invalidate catalogue data. Completed upload receipts do, including resumed transfers that were already completed. Collection forms and the schema builder share the same field query key; template fields have a separate template key.
- **Image access after visibility changes:** previously loaded blobs survived navigation indefinitely. Blobs now live only while consumers are mounted; concurrent consumers still share a request. Reopening a photo after all consumers leave checks server access again. A browser test loads a public photo, makes its collection private through a different session, and verifies a fresh image request returns 404. This concerns redisplaying previously loaded photos, not access to unseen images.
- **Image request races:** old requests could delete replacement cache entries after an account change. Failure cleanup and reference release now operate on the acquired entry, without deleting or releasing a newer entry for the same URL.
- **Language migration:** existing localStorage choices now migrate to cookies. An existing cookie takes precedence, and unavailable storage falls back to the server locale.
- **Minor cleanup:** removed the two trailing-whitespace errors.

Additional regression tests exposed two timing cases during implementation: pre-write reads could overwrite updated cache data, and schema refetches or delayed editor initialization could replace unsaved input. Affected reads are now cancelled before invalidation. The schema editor initializes synchronously when a field is selected and preserves unsaved input during background refreshes.

## Local verification

| Check | Result |
| --- | --- |
| Backend `pytest` | 98 passed |
| Frontend ESLint | Passed |
| Frontend TypeScript | Passed |
| Frontend Vitest | 41 passed |
| Next.js production build | Passed |
| Playwright Chromium | 13 passed |
| Ruff on changed E2E server helper | Passed |
| `git diff --check` | Passed |

Browser coverage includes account verification and session renewal/revocation; schema creation, editing, ordering, deletion and template application; collection/item saves and deletes across navigation; stars; saved language and dark theme; public-image access changes; backup export/restore; and interrupted upload recovery without retransmitting accepted chunks.

Playwright uses the production frontend build with a disposable migrated database, upload directory and local SMTP sink. The test-only server resets rate-limit counters between scenarios so their account setup does not accumulate against one loopback IP; limits remain enforced within each scenario and covered by backend tests. Production rate limiting is unchanged.
