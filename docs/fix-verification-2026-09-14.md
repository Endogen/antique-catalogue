# Fixes and local verification — 2026-09-14

All ten findings in the September 13 codebase review and its four additional
inconsistencies have been addressed in the local working tree.

## Resolved findings

| Finding | Implemented behavior |
| --- | --- |
| Draft photo disclosure | Image lists and every photo variant require the owner while an item is a draft, including in public collections. |
| Metadata lost after rename/edit | Field renames migrate stored keys transactionally. Deleted/unmapped values are retained in an owner-only archive. Incompatible type/option changes are rejected before modification. Migration 0016 preserves existing orphan values. |
| Private values exposed by moves | A destination preview lists transferred, privately preserved, and missing fields. Unsafe/incompatible values remain owner-only. Moves into public collections require a separate review/save before publishing. Required fields are validated before publication. |
| Password reset leaves sessions valid | Server-side sessions, token version checks, refresh rotation, current-session logout, and reset of all sessions/recovery links close the revocation gaps. |
| Vulnerable frontend dependencies | Upgraded to Next.js 16.3.5 and React 19.3.0 with compatible dependencies, async server APIs, ESLint configuration, and Node 22 runtime. |
| Images fail after idle session expiry | JSON and image requests share token renewal, retry, concurrent refresh deduplication, and in-memory token fallback. Already-prefixed API image URLs are handled correctly. |
| Verification recovery dead end | Added rate-limited resend, old-token retirement, clickable verification/reset links, bounded SMTP retries, and visible delivery errors. Both old re-registration prompts now lead to resend. |
| Failed moves break photo paths | Photos are copied before the database move commits. Copy/commit failures preserve the source; a copy failure returns a retryable error and permits retry. Cleanup after a successful commit is best effort. |
| Timestamp precision/timezone loss | Unchanged values retain their original offset and precision. Edited local values serialize as absolute ISO timestamps. |
| Older drafts disappear | Speed Capture requests drafts only and provides pagination beyond 100 drafts. |

The three existing composite indexes are now declared in the ORM; Alembic detects
no model/schema drift. The frontend has real regression/browser tests. The README
now matches API routes, authentication, sorting, runtime versions, migrations, and
test commands. Photo caching requires revalidation against current visibility.

## Verification results

| Check | Result |
| --- | --- |
| Full backend pytest suite | **86 passed** |
| Frontend Vitest regression suite | **8 passed** |
| Playwright against standalone production frontend + real API | **3 passed** |
| Frontend ESLint | Passed, no warnings |
| TypeScript `tsc --noEmit` | Passed |
| Next.js production build | Passed |
| Ruff for application, migrations, and new Python tests | Passed |
| `npm audit` including development dependencies | **0 vulnerabilities reported** |
| Migration 0015 → 0016 with historical data, downgrade, re-upgrade | Passed; values retained |
| `alembic check` after upgrade and re-upgrade | Passed; no schema drift |
| `git diff --check` | Passed |

Browser scenarios covered:

1. Register, receive actual SMTP mail locally, resend verification, follow the new
   link, sign in, rename a schema field, edit an item without losing its timestamp
   or metadata, preview/move into a public collection, confirm anonymous draft
   photo denial, publish, and verify the public page/API/photo exclude private data.
2. At a 390 × 844 viewport, upload a photo through Speed Capture, verify the image
   actually decodes, expire the access token, navigate to item detail, verify a real
   refresh and decoded image, and confirm anonymous photo access remains denied.
3. Request and receive a reset email, follow its link, change the password, confirm
   old access and refresh credentials return 401, observe the old browser session
   return to login, and sign in with the new password.

No uncaught page errors were recorded on the primary test pages. Desktop move
preview and mobile capture screenshots were inspected. The tests use a temporary
migrated SQLite database, temporary photo storage, and a loopback SMTP server;
production data and external email accounts were not used.

## Operational notes

- Apply migration 0016 before running the updated backend; the Docker Compose
  startup command already runs `alembic upgrade head`. Existing sessions must sign in again.
- Set `PUBLIC_APP_URL` to the actual public origin for emailed links and configure
  SMTP. Local SMTP transport and failure handling passed; external provider delivery
  was not tested.
- New image responses require revalidation. Copies cached under the previous
  immutable policy cannot be withdrawn retroactively by changing response headers.
- These checks cover Chromium desktop/mobile viewports, not a physical phone's
  camera, every browser, or production deployment. No deployment was performed.

## Product enhancements to consider next

1. **Export and restore:** a portable ZIP of photos, schema, and metadata, with
   import validation and a field-mapping preview. Prioritize this for long-term
   ownership of an archive.
2. **Draft inbox and upload recovery:** show missing fields and photo counts,
   support batch completion/public preview, and persist a retry queue for
   interrupted mobile uploads.
3. **Provenance and supporting documents:** private receipts/certificates,
   acquisition and restoration records, storage locations, and loan history.
4. **Printable catalogues and QR labels:** configurable PDFs and physical labels
   linked to public entries or authenticated owner views.

These are recommendations, not additional features implemented in this fix pass.
