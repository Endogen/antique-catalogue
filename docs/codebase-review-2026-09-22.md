# Codebase review — 22 September 2026

Reviewed baseline: `a8a85b6` on `main`. The findings below describe that baseline. All confirmed findings and the listed maintenance improvements have now been addressed; see the resolution and verification section at the end.

## Confirmed functional findings

### 1. P1 — Item-page batch uploads can lose selected photos on reload

Location: `frontend/components/image-uploader.tsx:105–108`.

The item uploader awaits each complete network upload before passing the next selected file to the persistent queue. Subsequent files exist only in component state. This is the same class of durability problem that was fixed in Speed Capture, but that fix did not cover this component.

Browser reproduction: selected three photos, held the first upload request, and confirmed that the interface showed two photos as queued while IndexedDB contained only one job. After reload, only that one job remained.

Recommended fix: persist every selected file before serializing network uploads. Reuse the shared enqueue/resume flow and derive the component's status from persistent job IDs, including completed retries.

### 2. P2 — Item-page uploads reject oversized originals before resizing

Location: `frontend/components/image-uploader.tsx:147–152`.

The component still rejects originals above a hard-coded 10 MB threshold, before the shared resizing/upload code runs. This blocks photos that could shrink below the server limit and also ignores deployments with a larger configured limit.

Browser reproduction: selected a valid PNG padded above 10 MB. The page displayed “File exceeds the 10MB limit”; no upload request was started. The browser can decode the PNG and discard the padding during re-encoding.

Recommended fix: validate type/emptiness locally, pass the photo through the shared preparation flow, and let the server enforce its configured byte limit. Update the fixed “Up to 10MB each” copy too.

### 3. P2 — One account's pending uploads exhaust another account's allowance

Location: `frontend/lib/upload-queue.ts:120–121`; compare account filtering in `frontend/components/upload-queue.tsx`.

The client counts every unfinished job in IndexedDB against its 20-job limit. The upload UI and server limits are account-specific. A user switching accounts can therefore be blocked by jobs they cannot see or discard in the active account.

Browser reproduction: seeded 20 pending jobs belonging to a different account. A new capture was refused with “Finish or discard pending uploads first,” while the active account had no Uploads control or visible pending jobs.

Recommended fix: scope the limit to `job.owner === owner`. Keep writes/count checks atomic if supporting concurrent selections or multiple tabs.

### 4. P2 — An accepted item name can make backup export fail

Locations: `backend/app/schemas/items.py:26`, `backend/app/schemas/collections.py:26`, and `backend/app/api/archives.py:55–71,173`.

The creation/update API accepts names longer than 200 characters, but the archive schema limits both item and collection names to 200. Export validates the manifest without handling that mismatch.

API reproduction: creating an item with a 201-character name returned HTTP 201; exporting its collection returned HTTP 500. The standard collection/item forms have their own shorter limits (120/160 characters), so this is particularly relevant to API clients and existing imported data.

Recommended fix: align create/update/archive validation and provide a compatible path for existing longer names. Adding only a new input limit will not repair existing affected collections. Do not silently truncate archived names.

### 5. P2 — Numeric metadata accepts non-finite values

Location: `backend/app/services/metadata.py:59–64`.

Numeric validation checks the Python type but not whether a floating-point value is finite.

API reproduction: submitting a numeric metadata value as the JSON number `1e309` returned HTTP 201 and persisted positive infinity. Both create and list responses represented the value as `null`, hiding what was stored.

Recommended fix: reject non-finite numbers before persistence, also validating archive metadata. Review existing values for repair and ensure frontend serialization does not silently turn an overflowing number into null.

### 6. P2 — Documented image settings are not wired into Docker deployment

Locations: `docker-compose.yml:9–29,36–48`; `frontend/Dockerfile:11–15`.

Backend image environment variables are absent from Compose's explicit environment mapping. Frontend image settings are build-time values, but the Docker build exposes no corresponding arguments or environment values.

Configuration reproduction: supplied `MAX_IMAGE_BYTES`, `IMAGE_LARGE_MAX_SIZE`, and `NEXT_PUBLIC_IMAGE_MAX_SIZE` to `docker compose config`. The resulting backend environment did not contain either backend setting, and frontend build arguments were empty. No deployment was performed.

Recommended fix: pass the backend variables into the container, expose the frontend variables as build arguments/environment during `npm run build`, and document when rebuilding is required.

## Dead-code candidates

Reference checks across application code and tests found no callers for these internal frontend API wrappers in `frontend/lib/api.ts`:

- `authApi.refresh`
- `adminApi.deleteCollection`
- `publicCollectionApi.featured`
- `publicCollectionApi.featuredItems`
- `speedCaptureApi.newItem`
- `speedCaptureApi.addImage`

`SpeedCaptureAddResponse` is also unused. These wrappers/types can be removed after turning the reference check into a repeatable check. The underlying backend endpoints should not be removed solely because these particular frontend wrappers are unused: some routes are called through other code or may serve API clients.

No wholly unreachable modules were found in the application import graph. Model registration imports and migration files are framework entry points, not dead code.

## Maintainability improvements

1. Share the upload lifecycle between item pages and Speed Capture. Two separate component queues are already producing different validation and recovery behavior.
2. Use the shared focus-trap hook for the archive dialog; it currently duplicates partial keyboard handling and omits the shared scroll-lock behavior.
3. Avoid producing all JPEG variants during archive inspection. Preview calls `inspect`, restore calls it again, and restoration generates the variants a third time. Separate bounded image validation from actual variant generation.
4. Add continuous checks for backend Ruff, frontend lint/typechecking, tests, and browser regressions. No GitHub Actions workflow exists in the checkout.
5. Clean up the backend lint debt and deprecated HTTP status aliases. These are maintenance issues rather than evidence of failing user flows.

## Verification

- Backend: **120 passed**, with two warnings for the deprecated `HTTP_413_REQUEST_ENTITY_TOO_LARGE` alias.
- Frontend unit tests: **54 passed**.
- Existing browser suite: **19 passed**, using the production frontend build, a disposable migrated backend, and Chromium.
- Frontend ESLint, TypeScript, and production build: **passed**.
- Additional browser probes: **3 passed**, asserting the observed oversized-file, batch-durability, and cross-account quota defects.
- Additional API probes: **2 passed**, reproducing the long-name export failure and observing the non-finite metadata mismatch.
- Backend Ruff: **failed with 8 findings** — five import-order issues and three overlong lines.
- Docker Compose configuration: evaluated without starting or changing containers.

The passing baseline suites do not cover the confirmed defects above. The temporary probes intentionally demonstrate existing behavior; they are not fixed-behavior regression tests yet. Probe sources are retained in `/tmp/antique-review-2026-09-22/`; execution logs are `/tmp/antique-audit-*.log`.

Testing was local and used Chromium, including the existing mobile viewport tests. Safari, real iOS devices, production deployment, and load testing were not exercised.

Recommended repair order: batch durability first; then the upload limit/account consistency issues; then archive and metadata validation; then Docker wiring and cleanup.


## Resolution and verification

All six functional findings are fixed:

- Item selections are committed together to IndexedDB before network work. Both upload screens and automatic/manual recovery use the same network scheduler. Stored sequence numbers retain selection order after reload. Inline status follows persisted jobs, including resumed and discarded uploads.
- Item uploads use shared type/empty checks and resize before the server applies its configured byte limit. Removed the fixed 10 MB rejection and outdated copy.
- The pending-photo allowance is scoped to the account. Counting and insertion share one IndexedDB transaction, preventing concurrent tabs from exceeding the allowance.
- Create/update schemas limit new names to 200 characters. Backups retain legacy names without truncation; restoration permits the original longer collection name. Regression tests cover both API validation and legacy round trips.
- Numeric metadata rejects non-finite values in forms, API writes, and nested archive values. Migration `0018` preserves existing invalid values privately as text, keeping finite values and nested structure. Migration tests cover positive/negative infinity, NaN, and repeat upgrades.
- Compose forwards all backend image settings and both frontend build arguments. The Dockerfile exposes the browser settings during compilation; README explains rebuilding.

Removed the six identified unused API wrappers, `SpeedCaptureAddResponse`, and the newly redundant `imageApi.upload`/`uploadPhoto` path. Removed obsolete upload translations. `npm run check:unused` checks application references to the remaining 74 wrappers using TypeScript symbols.

The archive dialog now uses shared keyboard/focus/scroll handling. Archive preview decodes images with the existing size and corruption checks without encoding JPEG variants. Ruff debt and deprecated HTTP aliases are fixed. GitHub Actions now runs lint, type checks, the API-wrapper check, unit/integration tests, a production build, and browser tests.

Two additional issues surfaced during verification and were fixed: an interrupted chunk was logged as an unhandled server exception, and Docker lacked exclusions for host dependencies/build artifacts. Interrupted chunks now retain the previous receipt and return a handled error; Docker contexts exclude generated files, local environments, and data.

Final local verification:

- Backend: **131 passed**, including migrations, invalid metadata, legacy backups, image validation, and disconnect/retry behavior; no warnings.
- Frontend unit tests: **59 passed**.
- Chromium browser suite: **24 passed**, including batch durability/order, resized large originals, cross-account limits, concurrent tabs, inline retry/discard status, and archive dialog behavior. The final run had no unhandled backend exceptions.
- Ruff, ESLint, TypeScript, API-wrapper references, production build, and `git diff --check`: **passed**.
- Docker Compose: all eight non-default image settings reach their intended environment/build arguments.
- Frontend Docker image: built successfully with custom image settings; confirmed both values in the shipped browser JavaScript and successfully served the login page from the built container. Temporary smoke-test containers were removed.

The GitHub workflow itself has not run remotely. Local browser verification uses Chromium, including mobile viewports; real iOS/Safari, production deployment, and load tests were not performed. Existing local/production databases were not modified; deploy with `alembic upgrade head` (automatic in Compose). This report records local verification before committing the fixes.
