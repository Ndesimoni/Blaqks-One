# Private workspaces and team activity

> **Connected product (BO1a, owner 2026-11-05):** the Blaqks One account (formerly the Super Admin) has no CRM workspace, opens no company's workspace and never switches into one; see [Blaqks One console](blaqks-one-console.md). The Super Admin sections below describe the frozen browser demo only.

Each member has a personal CRM workspace. Admins have full operations inside their own workspace; receptionists, staff and custom roles use their assigned modules inside theirs. Only the Super Admin can open another profile's workspace. The workspace banner identifies the profile whose records are currently displayed.

## Existing records and Aidah

The previous shared CRM records stay in the **Super Admin workspace**, using the original `kws-crm-v1` key. No real records are copied to a member or deleted. This organisation workspace stays with the Super Admin role when ownership is transferred.

Aidah has a separate personal workspace containing fresh fictional sample records. These come from the demo generator, never from the saved organisation records. Other personal workspaces start empty. Members can add their own leads, clients, landlords, contacts, listings, appointments and financial records. Profile IDs remain stable when names, emails or roles change.

Personal records use `kws-crm-v1:workspace:<encoded member ID>`. Personal targets use `kws-crm-preferences:workspace:<encoded member ID>`; the original preference key retains organisation targets and the browser's shared light/dark theme. Existing workbook field keys, original 17 sheets, property media and full JSON backup format remain compatible.

## Super Admin experience

- **Settings → Workspaces** lists the organisation workspace and every member, with record totals, search and one complete card collection with normal page scrolling.
- **Open workspace** loads that profile's complete CRM. Searches, editors, selected clients and message drafts reset; the URL retains the workspace through navigation and reload.
- **Settings → Team activity** shows activity across all workspaces, with workspace, member, action, module, date and text filters. Dates display in Dubai time.
- Members see activity only from their own workspace and the modules their role allows. Other members' activity and workspace filters are unavailable.

Record IDs can repeat between profiles. Each workspace is loaded separately, so linked clients, properties, deals and contacts resolve within their owner's data. Totals on the directory are calculated per workspace rather than merging record collections with duplicate IDs.

## Activity and persistence

The browser records creation, editing, deletion, task/status updates, workbook imports, backup restores, clearing/loading samples and completed message previews. Each entry includes actor ID/name, workspace ID, action, module, record ID/label, timestamp and changed field names. Message previews are explicitly **not sent**; recipient addresses, message subjects/bodies, passwords and provider tokens are not stored in the history.

The latest 500 actions are stored inside each workspace envelope alongside its records. A single browser write persists both records and activity. Failed writes keep both in memory and show the existing export/retry banner. Imports, restores and clear operations retain prior history. JSON/Excel exports and imports apply only to the workspace being viewed. The existing record backup format does not include team configuration, preferences or activity history.

`NavigationGuardProvider` coordinates forms, drafts, file operations and unsaved workspace data with one router blocker. Workspace changes remount scoped providers only after navigation is permitted. Invalid or unauthorised workspace links are rejected before opening a record repository. Corrupt stores are preserved for recovery and excluded from directory totals/history; the Super Admin can return to the directory through their personal workspace.

This is a browser-local frontend prototype. It does not provide server authorization, shared records across devices, online presence or an immutable audit trail. The backend phase must enforce workspace ownership on every query/write, including exports, messaging and media access, and record trusted activity on the server. Calendar integration remains deferred.

## Verification

Run `npm test`, `npm run build`, `npm run format:check` and `PLAYWRIGHT_CHANNEL=chrome npm run test:e2e`. Tests cover role/scope resolution, duplicate IDs, preserved legacy records, separate targets, activity attribution and filtering, failed writes, forged URLs, messaging/exports, unsaved navigation and mobile layouts in both themes.
