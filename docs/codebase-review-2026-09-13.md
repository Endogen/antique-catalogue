# Antique Catalogue codebase review

Reviewed 2026-09-13 at commit `e2d20c9` (`Harden auth and activity flows`).

**Resolved locally on 2026-09-14:** all ten findings and the additional inconsistencies
below have been addressed. This document records the original review; see
[the fix and verification report](fix-verification-2026-09-14.md) for current behavior,
passing checks, and deployment notes.

The highest priorities are protecting unpublished photos and private metadata, preventing metadata loss during schema edits, and closing gaps in account recovery. The existing test suite and production build pass, but the targeted probes below demonstrate failures outside that coverage.

This review added reports and diagnostic artifacts. Application source and dependencies were not changed.

## Findings, ordered by priority

### 1. [P1] Draft photographs are accessible anonymously

Source: [image access guard](/Users/endogen/Projekte/antique-catalogue/backend/app/api/images.py:69), called by image listing and image serving.

Create a draft with Speed Capture in a public collection. The public item-detail endpoint correctly returns 404, but anonymous requests to `/items/{item_id}/images` and `/images/{image_id}/original.jpg` both return 200. The guard checks collection visibility without checking `Item.is_draft`. Sequential IDs make the endpoints discoverable even though the UI hides the item.

The image response also permits public caching for a year. Draft photos should require the owner regardless of collection visibility. Apply one consistent item-visibility policy to item details, image lists, and every image variant, and add anonymous/non-owner/owner tests.

Evidence: reproduced with an actual uploaded PNG, converted and served through the application routes.

### 2. [P1] Renaming a metadata field can erase existing values on the next item edit

Sources: [field rename](/Users/endogen/Projekte/antique-catalogue/backend/app/api/fields.py:214), [form defaults](/Users/endogen/Projekte/antique-catalogue/frontend/components/item-form.tsx:120).

Create `Maker=Meissen`, then rename the field to `Manufacturer`. The field definition changes, but stored metadata remains keyed by `Maker`. Public output immediately drops the value because its key no longer matches a public field. The owner can still see it under Additional metadata, but the edit form initializes only current schema fields. Saving an unrelated name change sends `metadata: null` when the renamed optional field is blank, permanently replacing the old metadata.

Use stable field identifiers for stored values, or migrate keys transactionally during renames. Preserve unmapped values through ordinary edits and make destructive schema changes explicit. Field deletion/type changes and collection moves need the same preservation rules.

Evidence: API reproduction plus execution of the actual frontend `buildMetadataDefaults` and `validateMetadata` functions confirmed the null payload.

### 3. [P1] Moving an item can silently publish formerly private metadata

Sources: [collection move](/Users/endogen/Projekte/antique-catalogue/backend/app/api/items.py:478), [frontend move payload](/Users/endogen/Projekte/antique-catalogue/frontend/app/(app)/collections/[id]/items/[itemId]/page.tsx:439).

Give the source collection a private `Provenance` field and a public destination collection a public field of the same name. Move an item containing confidential provenance. The frontend deliberately omits metadata on moves, and the backend carries the old dictionary unchanged. Public serialization then uses destination field privacy, exposing the old private value immediately. The current move message tells users to edit destination metadata afterward, which is too late for this disclosure.

Before committing a move, map and validate destination fields and show which values would become public. Preserve privacy for unmapped or newly exposed values until the owner explicitly publishes them. Also handle destination required fields and incompatible field types.

Evidence: source public response omitted the confidential value; destination public response returned it after a normal move request.

### 4. [P1] Password reset does not revoke existing sessions

Sources: [password reset](/Users/endogen/Projekte/antique-catalogue/backend/app/api/auth.py:324), [refresh validation](/Users/endogen/Projekte/antique-catalogue/backend/app/api/auth.py:243), [access-token validation](/Users/endogen/Projekte/antique-catalogue/backend/app/api/deps.py:45).

Resetting a password changes the hash and consumes the reset token, but does not invalidate previously issued access or refresh tokens. A pre-reset access token still reads `/auth/me`, and a pre-reset refresh token still issues a fresh session. Someone retaining an old refresh token can keep renewing access after the owner resets the password.

Add a session version or revocation timestamp checked by both token paths, or use revocable server-side sessions. Invalidate outstanding recovery tokens as part of the same recovery operation. Logout/refresh-token rotation should share a clear session-revocation policy.

Evidence: both old-token requests returned 200 after a successful password reset.

### 5. [P1] The pinned Next.js release needs a security upgrade

Source: [frontend dependencies](/Users/endogen/Projekte/antique-catalogue/frontend/package.json:20).

The application pins Next.js 14.2.5. On the review date, `npm audit` reported 17 affected dependency packages: 1 critical, 13 high, 2 moderate, and 1 low, including development dependencies. Next.js is the direct dependency classified critical. These are package advisory matches, not 17 proven exploitable application vulnerabilities.

The official [support policy](https://nextjs.org/support-policy) lists Next.js 14 as unsupported. The maintainer's [Server Components denial-of-service advisory](https://github.com/vercel/next.js/security/advisories/GHSA-8h8q-6873-q5fj) includes the pinned version in its affected range. Runtime exploitability was not tested. Other advisories have configuration-specific prerequisites; for example, the dynamic-hostname rewrite advisory does not match this project's fixed backend hostname.

Upgrade Next.js and its associated React/ESLint dependencies to compatible supported releases, then rerun audit and the application checks. Do not treat npm's suggested 14.2.35 update as evidence that every current advisory is resolved.

Evidence: local manifest, installed production build version, saved npm audit JSON, and maintainer sources.

### 6. [P2] Images do not recover when an access token expires

Source: [authenticated image hook](/Users/endogen/Projekte/antique-catalogue/frontend/lib/use-authenticated-image.ts:26).

The normal API client refreshes an expired session and retries. The image hook independently reads localStorage and calls `fetch`; a 401 becomes a blank image. Its effect depends only on the image URL, so a later token refresh does not retry that image. This affects newly opened image variants after an idle period and can race with session refresh during navigation. Already loaded blob images are unaffected.

Centralize authentication/refresh for image requests, use the same in-memory token fallback as the API client, and retry after renewal. Public images should not fail just because an optional stale token is attached.

Evidence: executing the actual hook with a mocked 401 produced one request, no refresh/retry, and a null image state. Full browser timing behavior was not exercised.

### 7. [P2] Expired email verification leaves users without a working recovery path

Sources: [registration duplicate check](/Users/endogen/Projekte/antique-catalogue/backend/app/api/auth.py:76), [verification-page advice](/Users/endogen/Projekte/antique-catalogue/frontend/app/(auth)/verify/page.tsx:252).

The verification page says to register again when the token expires. Registration rejects the existing email with 409, while login rejects the unverified account with 403. There is no resend-verification route. Lost verification emails and transient SMTP failures lead to the same dead end; the email service logs delivery failure while registration still reports that the email was sent.

Add a rate-limited resend flow for unverified accounts, retire old verification tokens, and update the UI advice. Include clickable verification/reset links and reliable delivery retries.

Evidence: expired verification returned 400, re-registration 409, and login 403 for the same test account.

### 8. [P2] A failed image-directory move reports success and breaks photos

Sources: [commit before moving files](/Users/endogen/Projekte/antique-catalogue/backend/app/api/items.py:530), [swallowed filesystem error](/Users/endogen/Projekte/antique-catalogue/backend/app/services/uploads.py:79).

The item is committed to its new collection before relocating its image directory. A filesystem failure is logged and swallowed, so the API still returns 200. Serving now looks in the destination directory, while files remain under the source collection. Retrying the same move does not repair it because the database already points to the destination. Deleting the old collection can subsequently remove the stranded images.

Prefer stable image storage paths independent of collection membership, or implement a recoverable move with explicit failure handling and compensation. Treat moving files differently from best-effort cleanup after deletion.

Evidence: a simulated `shutil.move` failure produced a successful item update followed by a 404 for a photograph that previously returned 200.

### 9. [P2] Saving timestamps strips timezone and seconds

Source: [timestamp input normalization](/Users/endogen/Projekte/antique-catalogue/frontend/components/item-form.tsx:110).

The backend accepts ISO timestamps with offsets and seconds. Opening the form converts `2026-09-13T10:30:45+02:00` to `2026-09-13T10:30`. Saving without changing this field sends the shortened value, losing both precision and the timezone. Subsequent parsing can interpret it in a different local timezone.

Define the timestamp semantics, convert explicitly for local input, and preserve the original value when unchanged. If these are absolute instants, serialize a normalized offset-aware value on edits.

Evidence: execution of the actual frontend defaults and validation functions reproduced that exact conversion with no validation error.

### 10. [P2] Speed Capture can hide older drafts

Source: [existing-draft load](/Users/endogen/Projekte/antique-catalogue/frontend/app/(app)/speed-capture/page.tsx:584).

The page requests the newest 100 items with `include_drafts=true`, then filters drafts client-side. That flag includes finished items too. A collection with one old draft and 100 newer finished items therefore shows no existing drafts. Larger draft sets are also truncated without pagination.

Add a server-side draft-only filter or dedicated paginated draft endpoint. Use its count and results consistently in Speed Capture and the collection draft view.

Evidence: a fixture with one older draft and 100 newer finished items returned a session draft count of 1 but no drafts in the exact item query used by the frontend.

## Additional inconsistencies and coverage gaps

- **Migration/model drift:** all 15 migrations apply to a fresh SQLite database, but `alembic check` fails because the ORM omits `ix_activity_logs_user_created`, `ix_collection_stars_user_created`, and `ix_item_stars_user_created`. Declare these intended indexes in the models so future autogeneration does not propose dropping them. Existing tests create tables from ORM metadata and therefore do not exercise the exact migrated schema.
- **Frontend tests:** [the test script](/Users/endogen/Projekte/antique-catalogue/frontend/package.json:11) only prints “No frontend tests yet.” Add regression coverage for expired-token image loading, rename/edit preservation, timestamp round-tripping, and moving items between different schemas. A small set of browser workflows would catch boundaries the backend suite misses.
- **Documentation:** the README says 14 migrations, but there are 15. It documents `/auth/forgot-password` and `/auth/reset-password`, while actual routes are `/auth/forgot` and `/auth/reset`; it also advertises image query-token access that the current dependency no longer accepts. It describes multi-field sorting, while the item API accepts one sort expression.
- **Public-image cache policy:** images are served with a one-year immutable public cache directive even though a collection can later become private. Fresh origin requests will be denied after the switch, but an existing browser/shared-cache copy can remain usable. Choose a revalidation policy consistent with changing collection visibility.

## Product improvements that fit this catalogue

1. **Portable collection export and restore.** Offer a ZIP containing photos, schema definitions, and JSON/CSV metadata, plus import with field mapping and a preview. This makes the catalogue useful for long-term archives and helps users trust it with substantial cataloguing work. Keep owner exports and public sharing exports distinct so private fields are handled deliberately.
2. **A dedicated draft inbox with explicit publishing.** Show incomplete items, missing required fields, and photo counts; support batch editing and a public preview before publication. Add resumable uploads and a visible retry queue for interrupted mobile capture. This develops the existing Speed Capture workflow into a reliable end-to-end process.
3. **Provenance and supporting documents.** Build reusable collector templates for maker, period, material, dimensions, condition, acquisition source, storage location, and loan history. Add receipt/certificate attachments with privacy controls. Custom schemas already provide a foundation; document attachments and private history would add practical value.
4. **Printable catalogues and inventory labels.** Generate collection PDFs and QR labels linking physical objects to their catalogue entries. Include a clear choice of public or owner-only information. This connects the digital archive to finding, documenting, and displaying real objects.

Recommended sequence: fix privacy and data preservation first; then account/session recovery and dependency upgrades; then make draft capture reliable and add export/restore. Expand collector-specific features after those foundations are stable.

## Validation and review limits

| Check | Result |
| --- | --- |
| Existing backend suite | 75 passed |
| Frontend lint | Passed |
| TypeScript check | Passed |
| Production frontend build | Passed |
| Fresh SQLite migration to head | Passed, 15 migrations |
| Alembic model/schema comparison | Failed: three omitted ORM indexes |
| Targeted API defect probes | Seven current failures reproduced |
| Frontend function/hook probes | Three behaviors reproduced, including rename corroboration |
| Dependency audit | 17 affected packages; includes development dependencies |

API probes used isolated in-memory databases and temporary image directories. Filesystem failure was injected only in that isolated environment. Frontend probes execute transpiled source with minimal test doubles; they are not end-to-end browser tests. No production data or accounts were accessed, no emails were sent, and framework exploitability was not tested.

Saved evidence: [API probes](/Users/endogen/Projekte/antique-catalogue/graphify-out/review-evidence/test_review_repros.py), [frontend probes](/Users/endogen/Projekte/antique-catalogue/graphify-out/review-evidence/frontend-probes.cjs), [npm audit JSON](/Users/endogen/Projekte/antique-catalogue/graphify-out/review-evidence/npm-audit.json). The probes deliberately assert current defective behavior; they are diagnostic reproductions, not passing correctness tests to add unchanged to CI.

Graphify mapped 161 source/configuration files, 3 documents, and 6 images into 1,380 nodes. Its map has extraction limitations: 319 dangling-endpoint edges, 409 collapsed edges, and 2 self-loops. All reported application defects above were checked against source and independent evidence rather than inferred from graph edges. See the [graph report](/Users/endogen/Projekte/antique-catalogue/graphify-out/GRAPH_REPORT.md) and [interactive map](/Users/endogen/Projekte/antique-catalogue/graphify-out/graph.html). Graph semantic token usage was unmetered.
