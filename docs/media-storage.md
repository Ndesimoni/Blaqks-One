# Private file and photo storage

Design for packets F1–F4 (owner asked to start 2026-10-21). Files and photos leave the
database and the record JSON for private, S3-compatible object storage: MinIO in Docker
locally and in the tests, a UAE-region S3 service in production
([tech stack](tech-stack.md)). Nothing is public: every download is checked by the API
against the item the file belongs to.

## Rules

- **Module `media/`** owns schema `media` and the storage bucket. It stores, reads and deletes
  objects and knows nothing about chat, records or email. Each owning module attaches files
  to its own items and serves them through its own routes after its own access check
  ([service boundaries](service-boundaries.md) rule 9).
- **Upload:** `POST /api/crm/workspaces/{workspace}/media` with the raw file and its
  type. The API checks the real type from the file's first bytes (JPEG, PNG, WebP, PDF;
  never SVG, HTML or scripts), the size (10 MB images, 20 MB PDF), and removes photo
  metadata (EXIF, including GPS location, and PNG/WebP text chunks) before storing. The
  stored name is a random key; the original file name is kept only as display text.
- **Pending until attached:** a new upload belongs to its uploader and is unattached. An
  owning module attaches it in the same transaction as its own item (a chat message, a
  record). Unattached uploads are removed after 24 hours.
- **Downloads** stream through the API with `Content-Disposition`, `nosniff`, a fixed
  content type and `Cache-Control: private, no-store`; storage is never reachable from
  the browser. Images display inline; PDFs download.
- **Quotas:** per-member upload rate limit and a per-company storage cap.
- **Deletion:** removing an item hides its files at once; storage objects are deleted by a
  worker sweep. Archived members' files stay with their items.
- **Secrets:** the storage access key and secret come from the environment and never reach
  the browser, logs or the database. Requests are signed with AWS Signature V4.

## Security review (F1, 2026-10-21: accepted after fixes)

- JPEGs keep only an allowlist of segments and end at the first end-of-image marker, so a
  second picture or video a phone appends (with its own location data) is cut off; PNGs keep
  only known-safe chunks. PDFs are stored as uploaded, served only as downloads.
- One member may hold at most 200 MiB of unsent uploads, counted under a per-member lock;
  four uploads are processed at a time, checked before the body is read.
- Display names lose control and text-direction characters.
- Later: a per-member in-flight cap or body-read timeout, and stripping segments between the
  scans of progressive JPEGs (only crafted files have them).

## Packets

- **F1 — storage core and chat attachments (built 2026-10-21):** schema `media` and the
  bucket (SeaweedFS in Docker locally, `npm run db:up` starts it with PostgreSQL), a Signature
  V4 S3 client, upload with type sniffing and metadata removal, quotas (60 uploads an hour per
  member, 5 GB per company), the unattached sweep in the worker, and photos and files in team
  chat (up to 10 per message, text optional).
- **F2 — property photos and floor plans (built 2026-10-21):** in connected mode the browser
  redraws each photo as a 2048px JPEG plus a 480px thumbnail and uploads both; PDF floor
  plans upload as they are. A media entry is `{name, file, thumb?, type?, added?}`; the
  record attaches the named files (only the saver's own pending uploads) in its own
  transaction, hides files no longer named and removes them all when the record is deleted.
  Files load through `GET …/records/{collection}/{id}/files/{file}` after the record's own
  visibility check. Earlier inline photos (`{name, src}`) still display and save unchanged.
  **Remaining:** a command that moves existing inline photos into storage; until then they
  stay in the record JSON.
- **F3 — email attachments:** received attachments stored for linked conversations; sending
  attachments with replies.
- **F4 — public photos:** approved, re-encoded copies for the public website through the
  CDN, only for listings the Super Admin has approved.
