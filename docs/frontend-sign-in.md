# Frontend sign-in preview

The React app opens at `/#/sign-in` before mounting the CRM workspace. Email and password are required. Before team setup, Aidah and Simoni both have the **Admin** role and access to all 19 CRM screens. Successful sign-in opens the dashboard; a valid session allows normal deep links and refresh. The [Team and messaging preview](team-access-preview.md) adds one Super Admin, invitations, mandatory phone entry at activation, custom roles and separate messaging permissions.

## Sample credentials

These are public demo details for the frontend preview:

| Admin  | Demo email                 | Demo password   |
| ------ | -------------------------- | --------------- |
| Aidah  | aidah@keyswithsimoni.test  | SimoniDemo2026! |
| Simoni | simoni@keyswithsimoni.test | SimoniDemo2026! |

The email addresses are placeholders until the real addresses are supplied. The password is a public sample, not a password to reuse for a real account. The sign-in page shows these details. Edit `src/config/demoAccounts.js` to change the preview profiles.

## Behavior

- The form validates required fields and email format, masks the password, and offers Show/Hide. Unrecognized demo credentials stay on the sign-in screen with a clear error.
- The header account button and sidebar identify the current member. The account panel shows their email, assigned role, profile/settings links and **Sign out**. It closes with Escape, clicking outside, or moving keyboard focus away.
- Only `{ version: 1, adminId }` is stored in the tab's `sessionStorage`, under `kws-crm-demo-session`. Entered passwords are never saved, logged or sent to a server.
- Signing out clears this identity. It preserves records, property media, backups, targets and theme preferences. It uses a router transition so the record editor can block navigation when a draft or media upload is unfinished. File operations must finish first; failed record saves prompt before discarding in-memory work.
- Invalid sessions return to sign-in. Session write/clear failures show errors; a failed sign-out can be retried without falsely reporting success.
- Dark mode remains the default. The sign-in theme switch honors and updates the same preference as the dashboard. Mobile layouts fit the viewport in both themes.

## Frontend boundary

This is a demo sign-in flow, not authentication or a security boundary. Credential matching runs in the browser and the sample details are public. It does not verify identity, protect browser records, scope Google access to an admin profile, or create a shared database.

Each demo admin has a separate personal workspace. Aidah's fresh fictional examples are independent of the previous shared records, which now belong to the Super Admin organisation workspace. Only the Super Admin can switch profiles through Workspaces. A different browser, device, hostname or port still has its own local records. See [Private workspaces and team activity](private-workspaces.md). Google Calendar integration is deferred and does not run in the active frontend.

Production sign-in needs a server to verify real accounts, enforce the Super Admin/team permissions, establish protected sessions, and authorize all CRM, Calendar and messaging requests. Password reset, server session expiry, verified invitation/email links, and shared records belong to that phase. Replace `services/auth/demoAuth.js` and the session repository/provider with that integration; keep the form and profile components.

## Verification

Run `npm test`, `npm run build`, `npm run format:check`, and `PLAYWRIGHT_CHANNEL=chrome npm run test:e2e` (or the installed Playwright browser). Sign-in browser tests cover the signed-out gate, validation, both admins, reload/history, retained records, mobile themes, storage failures, and the unsaved editor guard. Existing CRM tests sign in through the form before exercising their workflows.
