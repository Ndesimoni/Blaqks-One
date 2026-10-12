# Save and import existing CRM records

The Super Admin can review and import **Clients, Contacts, Properties, Follow-ups, Viewings, Shortlist, Interaction log and Client care** into Docker PostgreSQL. Every linked client, contact or property must already exist in the destination workspace or arrive in the same import; otherwise the preview is rejected and nothing is saved. Other collections remain in the source browser and the complete backup. Nothing is copied automatically when connected mode starts.

## Create the backup file first

If your records are in the original browser CRM, open that CRM in the same browser profile and address used before. In **Data & export**, choose **Full backup with photos (JSON)**. The browser saves a complete file in your chosen download location. Keep organisation and personal workspace backups separate.

If connected mode uses the same browser profile and origin, sign in as a live Super Admin and choose **Import saved records → Saved browser workspace**. Select the existing workspace and click **Download source backup**. This creates the same established version 2 full JSON backup, including every record collection and existing photos/floor plans. It does not change the browser source. The file excludes login identities, team configuration and activity envelopes.

An empty file is not a backup of browser records. Records must be exported from the browser that holds them; the development agent cannot read another browser's local storage. Private backups should stay outside `public/` and source control.

A ready-to-use fictional example is provided at [`public/demo/demo-workspace-backup.json`](../public/demo/demo-workspace-backup.json). It contains 8 Clients, 3 Contacts, 13 Properties with labelled demo photos, plus the remaining original demo collections retained for later migration. It uses organisation ownership. This is a sample file, not an export of your existing browser data. Regenerate it with `npm run demo:backup`; it is a generated artifact excluded from hand-written file-size and formatting checks. Only this fictional file is served publicly.

## Review and import

Follow [Backend foundation](backend-foundation.md) to start Docker PostgreSQL, create a live Super Admin account and run the API and connected frontend. Demo sign-in credentials are not live server accounts.

1. Open **Import saved records** as the Super Admin.
2. Choose an existing saved browser workspace, or **Full JSON backup** and select the downloaded file.
3. For a file, confirm its **Original ownership**. Existing backup files do not contain a workspace owner; this is an operator assertion, not server-verified provenance.
4. Organisation sources are locked to the Super Admin organisation workspace. Personal sources require an explicit live member workspace; the organisation destination is unavailable. Legacy demo member IDs do not identify live accounts.
5. Leave **Add demo photos where a property has no uploaded photos** selected to embed labelled sample images in otherwise empty property galleries. Existing media stays intact. Turn it off to preserve the original media exactly.
6. Click **Preview import**. Review the source, destination and counts of new and already saved records. The screen also lists unsupported collections retained in the source.
7. Click **Import records**. A successful result refreshes or opens the destination workspace.

The browser copy and selected file stay intact. This import does not publish listings or send messages. Follow-ups, Viewings, Deals, finance and other unsupported collections need later backend stages; keep the full backup for them.

## Duplicate and failure behaviour

Imports add records without overwriting existing records. Legacy IDs, contact links, optional business metadata and inline media are preserved. Normalised matching records already saved in that workspace are skipped. Different records with the same collection/ID stop the entire import and show a conflict; resolve the difference in a copy before reviewing again.

The server validates the entire batch, inserts Contacts before linked Properties, and commits all records and redacted activity together. If any insert fails, the transaction rolls back. Every normal CRUD mutation and import uses the same workspace lock. Changes to the destination after preview require a fresh preview.

Preview tokens expire after 30 minutes and are bound to the authenticated active Super Admin and destination. Origin and CSRF protection still apply. Tokens are kept in frontend memory and hashed in PostgreSQL. A repeated successful commit with the same token returns its saved result without inserting records or activity again. If a response is lost, retry the current import before closing or starting a new one.

The API limits a batch to 1,000 records and a 12 MiB request. JSON file selection is capped at 15 MiB, and the existing backup parser retains the browser edition's storage-size contract. Large migrations and cloud media uploads need a later dedicated path. Records containing credential fields are rejected; credentials are never silently migrated as business metadata.

## Verification boundary

Automated tests exercise downloads, file validation, original-source preservation, linked media import, organisation/personal ownership, lost-response retry, identical-record skipping, conflicts, expiry, concurrency and database rollback using synthetic records in a disposable Docker database. That evidence does not mean your existing browser records have been transferred. An actual transfer requires their exported file or access through the original browser, plus live server accounts.
