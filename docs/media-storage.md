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
  **Backfill built (2026-10-22):** the operator command `media-backfill` moves existing
  inline photos into storage; see [F2 backfill as built](#f2-backfill-as-built-2026-10-22).
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
  **F3b (receiving) is built** (2026-10-22): migrations 0049 (`storage_pending`,
  `quota_group`, `quota_key` on `crm_media_objects`) and 0050 (`files_not_kept` on inbox
  messages), `media/inbound.rs` (prepare and reserve under the budgets) and
  `inbound_store.rs` (store after the commit), `inbox/intake_files.rs`,
  `integrations/sendgrid/inbound_files.rs`; the thread shows kept files with a "Files from
  outside the company" note and counts the rest. Suites
  `tests/api/sendgrid-inbound-files.test.mjs` and `sendgrid-inbound-files-guards.test.mjs`.
  Code security review (2026-10-22): no High findings. Fixed: storing runs apart from the
  request and holds the connection's slot, so SendGrid hanging up cannot lose files (L1);
  mail without a spam score counted as spam (L2; revised 2026-10-22, as SendGrid scores only mail up to 2.5 MB, [SendGrid design §14](sendgrid-design.md#14-preflight-against-sendgrids-documentation-2026-10-22)); the sender budget key is tied to the
  company (L3); files are only looked at for verified, unspammy mail (L4); more tests (L5).
  Accepted: the files are labelled, not yet scanned (M1); **scanning (ClamAV or the storage
  provider) is required before hosting**. Not covered by an automated test: a put that
  fails is hidden and counted (storage would have to fail on cue).
- **F4 — public publication copies (local implementation 2026-10-29):** the owner removed
  content approval. `media::public_assets` reserves neutral-named JPEG/PNG/WebP copies from
  deliberately selected, already processed property gallery media and attaches them as
  `public_snapshot` to an immutable publication revision. Public catalogue media checks
  current host/site/publication eligibility on every access. Original private documents,
  outside-share copies and PDF floor plans are not exposed; public PDF conversion and CDN
  operations remain future work. Connected photo selection now permits 20 photos and up to
  3 floor-plan images; the frozen browser demo retains eight photos. See [website backend](website-backend.md).

## F2 backfill as built (2026-10-22)

Photos and floor plans saved before F2 sit inside the record JSON as inline entries
(`{name, src, type?, added?}`, `src` a base64 data URL). `media-backfill` is a subcommand of
the API binary for the trusted operator only, like `migrate`: it runs on the server with the
database and storage settings and has no HTTP route.

**What it does.** For each workspace (or only `--workspace <id>`), it finds `Properties`
records with an inline entry in `media_photos` or `media_floorplans` and handles them one
record at a time. Each inline entry is decoded and checked exactly like an upload (the real
type from the bytes, the 10 MB / 20 MB limits, EXIF and PNG/WebP text removed, the display
name without path prefixes and ending in the stored type's extension) and becomes
`{name, file, type, added?}`, the shape F2 writes, owned by that record. There is no
`thumb`: the server has no image resizer, and the browser shows `file` when an entry has no
thumbnail (`ServerMediaProvider`). Stored entries and the order of entries are kept.

**What stays inline, unchanged, and is reported** (`left`, by record UUID, field and index):
`unsupported` (not a base64 data URL, not JPEG/PNG/WebP/PDF by its bytes, or a PDF among
photos), `unreadable` (bad base64 or a malformed image), `too_large`, `over_quota` (it would
take the company over its 5 GB), `other_fields` (fields a stored entry cannot keep, such as
the `demo: true, source: generated-demo` label, so
[labelled demo photos](demo-property-photos.md) stay labelled) and `invalid` (the record's
media fields, rewritten, would fail the validation a member's save uses, for example more
than 20 entries or another entry that is not a data URL; checked before anything is
reserved, so such a record is never uploaded again and again). Nothing is ever dropped.

**One record, one transaction.** Per record: (1) the rewritten media fields are built with
new file IDs and validated; (2) the files are reserved as rows attached to the record,
`origin = 'backfill'`, not yet stored, and committed; (3) each cleaned file is put and then
**read back from the bucket and compared with its reserved SHA-256** (security review M1),
all within 30 minutes; (4) in the record's own transaction, under the workspace lock, the
workspace must not be archived, the company must still be within its cap with these files
counted (review L3), the version must still be the one read (`UPDATE … WHERE version =
$read`), only the changed media fields are replaced (`payload || {media_photos: …}`), the
version is bumped and the files are marked stored. A record that changed meanwhile
(`changed_meanwhile`), a storage failure or mismatch (`failed`), the cap or a newly archived
workspace rolls back with nothing changed in the record, and its reserved files are hidden
at once (or by the sweep after an hour). The sweep keeps the objects of hidden, unconfirmed
backfill rows for that hour, longer than the 30-minute put deadline, so a put still landing
after a member's save hid its row is removed later rather than left untracked (review L1;
chosen over deleting from the command, which a crash could skip). Archived workspaces are
frozen and skipped (`archived: true`). A second run finds nothing left to move.

**Migration 0054** adds the `backfill` origin: such files never count against a member's
hourly or pending upload limits and can never be attached by a member. They do count toward
the company's 5 GB, and the backfill may use the company's remaining headroom; no margin is
kept, because the photos already belong to the company, inline photos are small (about
200 KB) and an over-cap entry simply stays inline as `over_quota`. The workspace owner is
recorded as `uploaded_by`, as for inbound mail.

**No activity entry: an exception awaiting the owner's decision.** AGENTS.md asks that
connected activity commit with scoped record mutations; this command writes no
`crm_activity` row, which is an exception the owner has been asked to confirm. Reasons:
activity answers "which member did what" and its `actor_id` must be a member; the operator
is not one, so naming the Admin would be a false attribution (actor and workspace IDs stay
distinct). The listing reads the same afterwards. The trace is the `origin = 'backfill'`
media rows (when, which record) and the version bump.

**Side effects to expect.** Members with the property open in an editor get "This record
changed. Reload before saving." when they save; `updated_at` changes; only the two media
fields pass through `serde_json` (a number inside them beyond f64 precision would be
rounded; inline entries carry none), other fields are merged unchanged by PostgreSQL.

**Report and logs.** JSON lines on standard output: first `{"mode", "storage": {"host",
"bucket"}}` (never credentials), then one line per workspace as soon as it finishes, with
`records`, `entries` and `bytes` (stored size after cleaning) moved or that would move,
`changed_meanwhile`, `failed`, `left`, `archived` and `stopped`. If a database error stops
the run, the current workspace's line is still written with `stopped: true` (review M2) and
the command exits with a fixed message; records already moved stay moved. Only workspace
IDs and record UUIDs are named: never file names, bytes, data URLs or record contents.

**Operator steps.**

1. Back up the database (a full PostgreSQL dump) **and the storage bucket**: after the
   move, database dumps no longer contain these photos.
2. Choose a quiet time (members editing properties will be asked to reload). Like every
   command, even the dry run first applies pending migrations (0054).
3. Dry run: `kws-crm-api media-backfill` (or `--workspace <id>`). Check that the
   `storage` host and bucket in the first line are the production ones, and read what
   would move and what stays inline and why. Nothing changes.
4. Apply: `kws-crm-api media-backfill --apply` (optionally per workspace). Re-run it for
   any `changed_meanwhile` or `failed` records; it is safe to repeat.
5. Entries left inline keep working as before; a member can replace them by uploading the
   photo again.

Tests: unit tests in `records/backfill/inline_tests.rs`, `plan_tests.rs`, `rewrite_tests.rs`
and `options.rs`; the database-backed `apply_tests.rs` (a record saved meanwhile is skipped
and its reserved files hidden); API suites `tests/api/media-backfill.test.mjs` (dry run with
nothing reserved, apply, served files without photo metadata, repeat run, items left
inline, another company untouched, a member save afterwards) and
`media-backfill-guards.test.mjs` (unreachable storage, archived company). Not covered
automatically: a read-back mismatch, a database error mid-run, and a workspace archived or
over the cap between planning and commit.

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
