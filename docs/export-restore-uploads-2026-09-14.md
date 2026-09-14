# Collection archives and resumable photos

Implemented locally on September 14, 2026, following the codebase fixes.

## User flows

- **Export:** open a collection, select **Export collection**, review the private-data
  notice, and download the ZIP. The versioned manifest contains schema definitions,
  metadata, privately preserved values, notes, timestamps, draft/highlight states,
  ordered original photos, and photo checksums.
- **Restore:** open **Collections → Restore collection**, select the backup, inspect
  counts and schema, choose a name, and restore a **new private collection**. Existing
  data is not overwritten. Original photo bytes are preserved, display variants are
  regenerated, and unassigned fields are privately preserved. Retrying a completed
  attempt returns the same collection.
- **Photos:** standard item uploads and Speed Capture persist selected files in
  IndexedDB and upload 1MB chunks. The **Uploads** panel shows progress, retry/discard
  controls, and completed item links. Reloading or reconnecting resumes accepted
  offsets. Server completion receipts prevent duplicate items/photos after a lost
  response. Current item galleries and capture counters update on queue completion.

## Design and limits

Archive imports are authenticated and validate version, schema structure, image
content, checksums, duplicates, and allowed paths without extracting supplied paths
onto disk. Failed restore file writes roll back newly created rows and clean up
new files. Restores do not copy stars, administrative featuring, or original IDs.

The archive limits are 250MB compressed/expanded, 10MB manifest, 10,000 items,
500 fields, 1,000 photos per item, and 20,000 photos total. This is native ZIP restore;
CSV import and merging into existing collections are separate future work.

Photos remain limited to 10MB each. The server allows 20 pending transfers per user,
and the browser queue allows 20 pending photos. Incomplete server payloads expire
at seven days, cleaned up on the next start request. Local files can restart expired
sessions. Completed receipts are retained for idempotency; their binary data is cleared.
Migration 0017 adds upload sessions and restore receipts. Docker Compose applies it
automatically. Pending binary upload data is held in SQLite and consumes storage.

Local recovery requires the same browser/device and account. Clearing browser data
or storage eviction may remove local photos. Closing the browser pauses transfers;
no background upload service runs after closure. Avatar and ZIP uploads are outside
this photo queue.

## Local validation

- Full backend suite: **96 passed**, including ten transfer tests.
- Frontend regression suite: **8 passed**.
- Production Chromium workflows: **5 passed**, including download/preview/restore
  and a simulated network loss after 1MB followed by reload/resume from that offset.
- Production frontend build, TypeScript, ESLint, Ruff, and whitespace checks passed.
- Migration upgrade, downgrade/re-upgrade, historical value preservation, and
  Alembic model comparison passed in the backend migration test.
- Inspected screenshots of restore preview and the interrupted-upload panel.

Transfer tests cover authorization, invalid paths/checksums/versions/duplicate ZIP
entries, photo fidelity and privacy after restore, repeated restore IDs, failed
storage and retry, chunk limits, invalid image data, duplicate chunks, incomplete
completion, repeated completion, and capture/existing-item uploads.

Tests use temporary databases/photos and local SMTP. No production data was used,
no deployment was performed, and physical mobile cameras were not exercised.
