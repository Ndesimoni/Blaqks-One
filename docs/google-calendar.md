# Google Calendar integration

**Deferred:** Calendar is removed from the active frontend while UI development continues. Its old URL redirects to the dashboard; connection/sync controls and background API requests are disabled. Follow-ups and viewings retain local scheduling and existing metadata. The following describes the retained integration for a future phase and is not the current frontend setup.

The Calendar screen at `/#/calendar` combines follow-ups, property viewings, client meetings and calls. Its month view and activity list work without a Google account. Appointments use Dubai time (`Asia/Dubai`, UTC+4); follow-ups with only a due date become all-day events.

## Connect your account

The integration uses the Rust/Axum service in `services/calendar-companion/`. Install Rust 1.89 or later and Node.js 20 or later.

1. Open the [Google Cloud console](https://console.cloud.google.com/), create or select a project, and enable the **Google Calendar API**.
2. Configure the OAuth consent screen in Google Auth Platform. For a personal test, add your Google account as a test user. Request these scopes:
   - `https://www.googleapis.com/auth/calendar.events`
   - `https://www.googleapis.com/auth/calendar.calendarlist.readonly`
3. Create an OAuth client with application type **Web application**. Register this exact authorized redirect URI:

   ```text
   http://localhost:5173/api/calendar/oauth/callback
   ```

4. Open `services/calendar-companion/.env` and enter the client ID and client secret there. If this file is missing in a fresh checkout, copy `services/calendar-companion/.env.example` to `services/calendar-companion/.env`. Keep an existing `CALENDAR_ENCRYPTION_KEY`; if it is blank, generate it once with `openssl rand -hex 32`. Keep that key and the encrypted store together. Never place the secret or key in a `VITE_` variable or a frontend file.
5. From the project root, start the service in one terminal:

   ```bash
   npm run dev:calendar
   ```

   Start React in another terminal:

   ```bash
   npm run dev
   ```

6. Open <http://localhost:5173/#/calendar>, click **Connect Google Calendar**, sign in, grant calendar access, and choose a writable calendar. A dedicated **Keys with Simoni** calendar is convenient but optional.

`APP_ORIGIN` and Google's redirect URI must match the address you use in the browser. If using `127.0.0.1` or another local port, update both. Vite proxies `/api/calendar` to the service on `127.0.0.1:8787`. Credentials are configured only in the backend; a missing setup leaves the Connect button disabled and keeps scheduling available locally.

This follows Google's [authorization code flow](https://developers.google.com/identity/protocols/oauth2/web-server) and [event creation API](https://developers.google.com/workspace/calendar/api/guides/create-events). No live Google account is connected by installing the code; sign-in and consent are required.

## Schedule and sync activities

- Use **Schedule follow-up**, **Schedule viewing**, **Schedule meeting**, or **Schedule call** on the Calendar page. Complete the record information, then the scheduling section, then review and save.
- Follow-ups and viewings also have a **Scheduling & Google Calendar** section in their existing forms. New activities created while a calendar is connected enable sync by default. Existing records require choosing **Yes** for **Sync with Google Calendar**. Sample records never gain sync merely by connecting Google.
- Choose a date and time, duration, reminder, and optional location or meeting link. Calls and meetings need a start time when linked to Google. An untimed follow-up uses its due date.
- **Send invitation to client** defaults to **No**. Choosing **Yes** requires a linked client with a valid email address. Google sends the invitation when the event is synced; later changes and cancellations notify invited attendees.
- Saving updates the linked event. Marking a task/viewing completed or cancelled, disabling sync, or deleting the CRM record cancels its managed event. Unrelated Google events are unaffected. Reopening a completed activity creates a new managed event.
- Status labels show **Pending connection**, **Pending**, **Synced**, **Failed**, or **Needs details**. Failed work retries automatically, with a manual retry button. Successful activities link directly to their Google event.
- Disconnecting revokes Google access and stops further syncing. Existing Google events remain. Reconnect and choose the same calendar to reuse the stored event links.

## Persistence and boundaries

CRM records remain in the existing browser storage. Scheduling fields are additional record metadata and survive version-2 full JSON backups. The original workbook remains a 17-sheet export; the new scheduling metadata is not exported to Excel, so use a full JSON backup to retain it.

The backend persists encrypted Google tokens, event IDs and queued desired changes in `services/calendar-companion/data/calendar.enc`. Authorization uses a browser-bound, single-use OAuth state and PKCE; mutations also require an origin check and session CSRF token. The browser receives connection and activity status, never Google tokens. Failed disk writes do not acknowledge new queue changes, and retries reuse stable event IDs.

Keep the backend running for pending changes to finish while the browser is closed. Edits must reach the backend before closing the browser; changes made with the service offline upload on the next open session. A stale tab cannot upload over a newer browser-storage snapshot, and an unreadable local workspace does not upload an empty replacement schedule.

The first stage sends **CRM → Google Calendar**. Google-side edits and unrelated events are not imported. Each browser session has its own account connection; this is a local companion bound to loopback, before the project's PostgreSQL records, application login and hosted multi-user backend. Public hosting requires that next backend phase.

## Verification

```bash
npm test
npm run test:calendar
npm run build
PLAYWRIGHT_CHANNEL=chrome npm run test:e2e
cargo clippy --locked --manifest-path services/calendar-companion/Cargo.toml --all-targets -- -D warnings
cargo fmt --manifest-path services/calendar-companion/Cargo.toml -- --check
npm run format:check
```

Browser tests start both Vite on port 5174 and the Rust service on port 8787. They force empty Google credentials and use simulated API responses for connected flows. Rust tests exercise the actual HTTP API, token refresh, event creation/update/cancellation, retry behavior, session isolation and encrypted restart recovery against a local fake Google provider. Live consent and Google delivery still need verification with your configured account.
