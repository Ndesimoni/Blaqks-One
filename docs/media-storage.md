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
- **F3 — email attachments:** see the F3 design below. **F3a (sending) is built** (2026-10-21):
  migration 0048, `media/contents.rs` and `naming.rs`, `inbox/send/files.rs` and
  `domain_files.rs`, Attach files in the reply box and New email, files on messages; suites
  `tests/api/sendgrid-attachments.test.mjs` and `tests/server-browser/inbox-attachments.spec.js`.
  Code security review (2026-10-21): no High findings. Fixed: the file reads (8 s) and the
  SendGrid call (at most 20 s) now fit the outbox's 30-second call budget, so slow storage
  retries instead of turning Unknown (M1); a Send again chain too long to follow fails
  rather than sending without files. Accepted: the Super Admin and other companies get the
  Inbox's usual 403 (not 404) on the file route; an object larger than its record retries
  before failing; a worker holds about 120 MiB at most for two large sends at once.
  **F3b (receiving)** is next.
- **F4 — public photos:** approved, re-encoded copies for the public website through the
  CDN, only for listings the Super Admin has approved.

## F3 design: email attachments (2026-10-21, security reviewed)

Company email through SendGrid (E3) first; a Google Workspace mailbox refuses attachments
(409 when queuing, and again in the worker) until its MIME builder gains them. The
separate security review found two High and six Medium issues; all are written in below.
Sending (F3a) builds first; receiving (F3b) builds on this corrected design.

**Files in general.**

- `crm_media_objects` gains `origin` (`upload` or `inbound`) and the owner kind
  `inbox_message`. Members' per-hour, pending and attach rules count and attach only
  `upload` files, so inbound mail can never use up a member's limits or be attached by a
  member (review H1).
- A display name always ends with the extension of its stored type (`.pdf`, `.jpg`,
  `.png`, `.webp`), replacing any other ending, in storage, in `Content-Disposition` and in
  the SendGrid `filename`, so a PDF can never be saved as `invoice.html` (M3).
- Production condition: inbound files are scanned (ClamAV or the storage provider) before
  they are served, or labelled "from outside the company" on download (M6).

**Sending (F3a).**

- The composer uploads each file through the existing upload route (F1 types, sizes and
  metadata removal). A reply or Start message names at most 10 of the author's own pending
  uploads, 15 MiB in all, attached to the new message (owner kind `inbox_message`) in the
  message's own transaction. Send again takes no new files and reuses the files of the
  original message (followed back through `repeat_of`).
- The worker reads files only by owner: kind `inbox_message`, the original message, in the
  message's own workspace, never IDs from the job or the request; each file's bytes must
  match its stored SHA-256 (L4). A missing or hidden file fails the message permanently: it
  never goes out without its files (M5). A storage failure before the call retries.
- SendGrid sends with attachments use their own client, whose timeout grows with the body,
  so a large send does not turn Unknown on the ordinary 10-second limit (L1).

**Receiving (F3b).**

- File parts are read as slices of the verified body (no copies), one at a time, and their
  names come from `attachment-info`; one unreadable part drops only that file (M4, L2).
- Files are reserved inside the intake transaction, already attached to the stored inbound
  message and marked not yet stored; after the commit the bytes are put, one overall
  deadline of 45 seconds for the mail, then marked stored. Only stored files are listed; a
  failed put marks the file not kept. Dropped, unverified-new, report and re-posted mail
  therefore keep no files (M1).
- Mail that is unverified or scored as spam keeps no files, only a count of files not kept
  (M2).
- Budgets per connection per day (1 GiB, 300 files) and per sender (100 MiB); inbound files
  never take the company above 80% of its 5 GB; a file whose SHA-256 is already in the same
  conversation is not stored again. Over any limit the message is kept and the file counted
  as not kept (H2).

**Viewing.** `GET …/inbox/conversations/{id}/messages/{message}/files/{file}` loads the
conversation with the viewer's own visibility, checks that the message belongs to it, then
serves through `media::serve` (`nosniff`, fixed type, `private, no-store`, sandbox CSP;
images inline, PDFs as downloads). Every refusal is the same 404: another member's
conversation for assigned-only staff, another company, a file of another message, a
guessed ID, the Super Admin, an archived member. `owned::list` gains a workspace filter.
The thread shows photos as thumbnails and other files as named pills, reusing chat's.
