# Project architecture

The modern React application is the source of truth for development. It uses feature folders, shared components, and a workspace provider. The original offline prototype is preserved separately.

## Connected CRM slice

`src/main.jsx` selects the app at build time using `VITE_CRM_MODE`. Default demo composition and storage contracts stay intact. In `server` mode, `features/server/ServerApp.jsx` composes the same design system, hash router and navigation guard around `ServerSession`, `ServerDirectory` and a workspace provider keyed by authenticated user and selected owner.

`services/crm/client.js` uses same-origin cookie requests and an in-memory CSRF token. `useServerRecords` loads authorised Clients, Contacts and Properties; `useServerMutations` waits for server commits and retains failed/conflicting form drafts. Canonical UUID/version metadata stays separate from workbook objects. The shared editor/details/property/contacts components work in both modes. The connected shell restores the familiar navigation groups and Settings links, filtering them by current grants. Clients, Contacts, Properties and Team open their working screens; unfinished routes are labelled **Not connected** and open status-only panels, without demo providers, forms or unsupported record actions. Server failures never fall back to demo identity or data.

Connected Dashboard navigation uses `/#/dashboard`; the normal sign-in home `/#/` still opens the first available connected collection. `useWorkspaceNavigation` accepts this connected Dashboard path while preserving the demo's original `/#/` dashboard. The active workspace query survives navigation, reload and browser history. The shared sidebar scroll hook keeps the current main navigation item visible, and mobile navigation retains the native dialog's focus and Escape behaviour.

`services/crm-api/` is the new Rust/Axum service. Its authentication, workspace access, record validation/mutations and redacted transactional audit are distinct modules backed by versioned PostgreSQL migrations. Local PostgreSQL runs through Docker Compose; integration tests use a separate disposable Compose project. The retained Calendar companion is independent. See [Backend foundation](backend-foundation.md) for setup, API contracts, verification and remaining production work.

Connected team UI lives in `features/server-team/`, independently of the older local preview. The API's `team/` modules separate role presets, member validation, invitation persistence/activation/renewal and scoped updates. Staff membership maps to the owning Admin's existing workspace; permission checks filter record reads and guard every collection mutation. Admin team-management authority does not grant Super Admin workspace switching or imports. Profile/session reads use current database membership and owner activity. See [Admin-owned teams](admin-owned-teams.md).

The Super Admin migration flow separates source reading/backup export, destination mapping, asynchronous media preparation, server preview and token commit. The source stays intact. Preview plans are actor/workspace scoped, expire after 30 minutes and use the same workspace transaction lock as normal CRUD; destination changes invalidate the snapshot. See [Data migration](data-migration.md). Property presentation uses labelled static demo fallbacks without mutating the model; import copies may embed deterministic sample media from `lib/demoPropertyPhotos.js`.

## Default demo application flow

```text
index.html
  → src/main.jsx
  → src/app/App.jsx
  → TeamProvider → SessionProvider + hash router
  → NavigationGuardProvider → setup/invitation/reset/email previews, sign-in/sign-out, or RequireSession
  → WorkspaceProvider → resolved personal/organisation scope → keyed ScopedWorkspaceProvider
      → layout components
      → selected feature page
      → record details and editor
```

`App.jsx` mounts a React Router hash data router. `SessionProvider` manages the frontend demo identity outside workspace state. Signed-out routes render the email/password form before the record repository mounts. Successful sign-in opens the member's workspace dashboard. `/#/sign-out` clears only the identity after the router's unsaved-form blocker permits navigation. The tab session stores only a version and admin ID; public demo credentials are matched locally through a replaceable adapter. Profiles use separate browser-local records. This gate does not authenticate real accounts or secure data. See [Frontend sign-in](frontend-sign-in.md).

`FeatureRoutes.jsx` lazy-loads the 19 CRM screens. Hash paths survive refresh and browser back/forward navigation on static hosting without server rewrites. A query passed from global search is retained in the Client desk URL. The former `/#/calendar` route redirects to the dashboard. Feature and root error boundaries provide retry/reload without clearing records.

Four additional routes provide Team & access, My profile, Workspaces and Team activity. `TeamProvider` owns a separately validated local team store; `SessionProvider` resolves identity and permissions from active members. `SectionAccess` gates routes and selects a limited dashboard for restricted roles; the sidebar and record/file actions use the same permission groups within the selected workspace. The Super Admin manages team accounts, custom roles and independent client messaging flags. New members add a required international phone during invitation activation. Team wizard, link, profile and message previews live in `features/team` and `features/messaging`; pure commands stay beside the feature UI. See [Team and messaging preview](team-access-preview.md) for invariants, storage, complete flows and the backend boundary. Workbook/backup formats remain unchanged.

`features/workspaces/model.js` resolves the requested `workspace` URL parameter before opening a repository. Non-owners can resolve only their own member ID; the Super Admin can resolve the separate organisation workspace or any member. `ScopedWorkspaceProvider` is keyed by actor/profile IDs, keeping all module arrays and view state inside one scope. `useWorkspaceNavigation` preserves the scope parameter through page navigation. `useWorkspaceOverview` reads other stores only for the Super Admin and calculates directory/history views without merging linked record arrays. See [Private workspaces and team activity](private-workspaces.md).

`NavigationGuardProvider` is the single router blocker for registered form drafts, busy file work and failed record saves. `useUnsavedChanges` registers each consumer, avoiding competing blockers. Profile switching cannot discard edits until permitted; permission changes can still revoke access.

`WorkspaceLayout.jsx` composes navigation, workspace context, headings and feature routes. `WorkspaceNotices.jsx` retains storage recovery and unsaved-change registration; `WorkspaceNotifications.jsx` owns transient feedback; `WorkspaceDialogs.jsx` owns shared record/message overlays and file inputs. `DataExportMenu.jsx` and `WorkspaceSearch.jsx` provide focused page/header controls.

`features/activity/model.js` appends validated entries to the affected workspace envelope, capped at 500 recent actions. Record actions and completed message previews record the actual actor separately from the workspace owner. History includes identifiers, labels and changed field names; message recipients and message text stay out. Team activity reads all permitted workspace histories for the Super Admin and only the current workspace for members. Activity is browser-local and excluded from the existing record-only backup format.

`features/messaging` provides the Messages page and a shared composer for manual single/bulk recipients and client/lead shortcuts. Its inline recipient picker filters Clients, Leads and Landlords; pure directory selectors merge shared addresses from existing Clients/Contacts records and retain search aliases. Selected recipients become removable chips; manual entry remains available. Directory access follows the relationship permission. The pure model normalizes and deduplicates addresses, removes chips while preserving invalid manual entries, validates all entries and channel permission, and generates only a local preview payload. `useRecordActions.startMessage` checks permissions and replaces open record details with the composer request in view state. `WorkspaceLayout` renders one composer; its stepped form guards unsaved edits and rechecks permissions at completion. Email and WhatsApp keep separate draft recipient lists. No draft persistence or delivery API is introduced; see [Messaging preview](messaging-preview.md).

`features/leads/LeadsPage.jsx` provides a dedicated acquisition view over existing `Clients` records. It shows source totals, campaign references, contact details, and lead stages, with combined source/stage/search filters. Pure selectors retain custom imported values and unrecorded sources. The shared table accepts an explicit column list for this view; the shared client editor retains its section-by-section form and displays lead labels from the current route. No separate lead collection or conversion copy is created: browser storage, linked records, JSON backups, and the 17-sheet workbook retain their existing contracts.

`ScopedWorkspaceProvider` composes five focused data/view contexts plus `WorkspaceScopeContext`. Consumers use only the hooks they need from `hooks/useWorkspace.js`; `useWorkspaceScope` provides the selected profile and workspace navigation:

| Hook                    | Responsibility                                                  |
| ----------------------- | --------------------------------------------------------------- |
| `useRecords()`          | Record envelope, records, summaries, persistence failures/retry |
| `useWorkspaceActions()` | CRUD, editors/details, backups and Excel file workflows         |
| `useNavigation()`       | Current section, URL navigation                                 |
| `useWorkspaceView()`    | Search, filters, pagination, reports, open drawers/menu/toast   |
| `usePreferences()`      | Theme, targets, preference persistence                          |

Context values are memoized. `useRecordActions()` depends on record data and stable state setters, so typing a search or toggling a menu does not recreate the record/action contexts. View state is still grouped; feature-owned local state can be added when a screen needs independent filters.

`useWorkspaceData()` owns the saved envelope and persistence/recovery states. `useWorkspacePreferences()` owns settings and theme synchronization. Both use storage repositories. Feature selectors are pure JavaScript modules next to their pages. Record commands and validation live in `features/records`; the shared editor composes `RecordField` and `PropertyMediaEditor`.

`Drawer` uses a native modal dialog with a labelled title, inert background, explicit Tab wrapping, Escape, scroll locking, and focus restoration. Record viewers and editors use its default centered placement: an 840px desktop overlay with an internally scrolling body, fixed header/footer, and a full-screen layout at widths up to 750px. Property records select its wide size (1040px), and their title receives initial focus so the gallery remains visible when opening. Mobile navigation explicitly uses side placement. The editor guards unsaved work during closing, in-app/browser history navigation, and document exit.

`features/records/formSections.js` assigns every editable workbook field to a logical section. Clients, Properties, Deals, Interaction log, and Client care use sequential sections followed by review; shorter modules remain one-page forms. `useRecordFormSteps()` manages navigation, section validation, complete-record validation, and focus/scroll restoration after a step change. The parent editor keeps the complete draft and property media, including fields in unmounted sections. `FormStepper` provides labelled progress/navigation; `RecordReview` summarizes entered fields and media with Edit section controls. Existing records allow direct section access, and property gallery actions open the presentation section. New records unlock steps in sequence, and only the final review submits a multi-section record.

## Responsibilities

| Folder                   | Put here                                                            |
| ------------------------ | ------------------------------------------------------------------- |
| `src/app`                | App composition, workspace orchestration, and actions               |
| `src/features/<feature>` | Pages and components specific to that feature                       |
| `src/components/ui`      | Reusable visual controls without workspace state                    |
| `src/components/layout`  | Persistent navigation, branding, and page chrome                    |
| `src/hooks`              | Workspace access, React state/effects, and persistence hooks        |
| `src/services/storage`   | Browser workspace and preference reads/writes                       |
| `src/services/files`     | JSON backup validation and browser downloads                        |
| `src/config`             | Navigation definitions, field options, theme, and storage constants |
| `src/data`               | Workbook schemas and fictional seed records                         |
| `src/lib`                | Non-React helpers and business rules                                |
| `src/styles`             | Global design system, responsive layout, and theme styles           |
| `public`                 | Assets served unchanged by Vite                                     |
| `tests`                  | Active unit, smoke, and browser regression tests                    |
| `docs`                   | Developer setup, product documentation, and screenshots             |

The ten data-entry screens other than Properties share `RecordsPage` and `RecordTable`. `ContactsPage` supplies contact-specific tabs and a pure matching selector to the shared page; it filters the existing Contact type field without changing workbook columns. Properties has its own `PropertyDirectory`, while the record detail and editor components support every data-entry module.

## Utility modules

| Module              | Responsibility                                                              |
| ------------------- | --------------------------------------------------------------------------- |
| `lib/records.js`    | Record-field lookup, labels, statuses, and numeric aggregation              |
| `lib/schema.js`     | Field metadata, blank workspaces, and unique record IDs                     |
| `lib/crm.js`        | Lead qualification, commissions, receipts, reminders, and calculated fields |
| `lib/properties.js` | Listing purpose, pricing, classification, and amenities                     |
| `lib/media.js`      | Photo/floor-plan access, validation, and image compression                  |
| `lib/excel.js`      | Workbook import and 17-sheet Excel export                                   |
| `lib/dates.js`      | Date arithmetic and display                                                 |
| `lib/format.js`     | Currency and number display                                                 |
| `lib/workspace.js`  | Workspace summaries and record search/filter/sort selection                 |

Workbook field keys, sheet names, and column letters remain compatible with the original files. Organisation records use `kws-crm-v1`; personal records use `kws-crm-v1:workspace:<encoded member ID>`. Full backups retain the `keys-with-simoni-full-backup` format and apply to the selected workspace.

## Storage boundary

The record repository exposes `read()` returning `{ workspace, error, raw }`, `load()` returning a validated workspace or throwing, and `save()`. A missing organisation/Aidah key starts independent fictional examples; other personal profiles start empty. Unreadable JSON, invalid envelope/record/activity shapes, duplicate IDs inside one workspace, or blocked access open the recovery screen; autosaving is suspended until the user retries successfully or explicitly chooses an empty workspace. Unknown metadata and record fields are retained, and missing module arrays are filled with empty lists.

Failed writes keep the in-memory records and activity, expose a persistent export/retry banner, and warn on navigation/document exit. Preferences fall back to valid settings/targets and report write failure separately. Dark mode is the default when no valid theme is saved; an explicit light-mode preference is preserved. Personal targets use per-member preference keys while theme remains browser-wide; original keys retain organisation data/targets. Repositories resolve storage lazily and accept an injectable getter for tests.

JSON restoration validates the backup format/version, records, media, and size before confirmation or replacement. Excel import reads namespace-prefixed or default-namespace OOXML, rich/shared strings, numeric zero, and dates. Missing workbook parts and unmatched sheets fail before replacement. Excel and JSZip are loaded on demand; Excel exports omit attachments while JSON backups retain them.

The repositories remain synchronous and browser-local. Calendar integration is deferred: `WorkspaceProvider` does not mount `useCalendarSync` or `CalendarContext`, and Calendar is absent from navigation and feature loading. Follow-up/viewing forms show local scheduling fields; sync, invitation and provider reminder controls are hidden. Retained integration metadata does not block local edits or change on save. The companion, hook and historical browser scenarios in `tests/deferred/` remain available for a later phase. The separate connected slice implements asynchronous loading and mutation states for its three modules. Remaining demo modules still need server repositories. Cross-device persistence exists only in connected mode; live cross-tab change notifications are not implemented.

The companion in `backend/` separates HTTP/OAuth handlers (`api.rs`), Google transport (`google.rs`), validated events and encrypted atomic storage (`store.rs`), and the background retry worker (`sync.rs`). Browser-bound OAuth state/PKCE and CSRF protect authorization and mutations. Queued events, stable event IDs and tokens survive service restarts in an encrypted local store; tokens stay out of the browser. Sync is one-way from CRM to Google, and scoped to explicitly enabled follow-ups/viewings. Client meetings and calls reuse follow-up records. See [Google Calendar integration](google-calendar.md) for setup and the local-only boundary.

## Styles

`styles/index.css` imports the existing feature styles in their established order, then `system.css` for shared product styling. Workspace, theme, frontend and listing/media styles use ordered manifests with named responsibility-based files. Shared palette/body defaults live in `foundation.css` and `theme/surfaces.css`; avoid redeclaring those tokens in feature files. Preserve manifest order and theme selector specificity when splitting styles.

`styles/system/` contains shared surfaces, navigation, page chrome, controls, forms, collection presentation, responsive rules and motion. `DashboardPage` and `PropertyDirectory` compose focused feature components; property filters can collapse without losing their values. See [CRM design refresh](design-refresh.md) and [Product design standards](design-standards.md).

`team.css` extends the existing semantic theme variables for team settings, standalone activation/setup forms and message previews. It retains centered desktop dialogs and full-screen mobile forms.

## Adding or changing a feature

`components/ui/OverflowList.jsx` provides disclosure, continuous scrolling and full-collection modes. More replaces a compact six-item summary with one complete list, and the same control becomes Close. Primary property cards use `Pagination.jsx` and normal page scrolling; searchable lists scroll continuously, and photo/step rows scroll horizontally. `lib/overflow.js` preserves original indexes and promotes active single choices without losing displaced options. Use this component for expanding lists; keep full collections in the feature model so validation, totals and exports include hidden entries. See [Clean collection and option browsing](option-overflow.md) for the UI audit, coverage and interaction behavior.

1. Find its page in `src/features`, or add a new feature folder for a distinct screen.
2. Put reusable controls in `components/ui` and non-React logic in `lib`.
3. Update `config/navigation.js` and `app/FeatureRoutes.jsx` when adding navigation.
4. Keep schema changes compatible with existing record keys and workbook columns.
5. Keep each changed code file within 150 formatted lines and run `npm run check:lines`, `npm run format`, `npm test`, and `npm run build`. Run relevant browser checks when changing user flows or component wiring; report remaining repository size violations.

## Future platform

The proposed [CRM, website and mobile platform design](platform-system-design.md) describes the next shared backend, private/public data boundaries, exact-version publication approvals and enquiry routing. Super Admin approval before public publication is a confirmed product decision; the public catalogue and enquiry pipeline remain unimplemented; the first connected private CRM slice is described above.

## Legacy boundary

`legacy/offline/src/App.jsx` and `legacy/offline/public` belong to the independent, zero-install prototype. Its bundled older runtime uses a hooks adapter. The modern app uses standard React 18 hooks directly.

`npm run build:offline` only rebuilds the legacy app. Vite only copies the root `public/` assets into `dist/`, so the offline HTML and libraries cannot overwrite the modern build.

Historical Python browser scripts live under `legacy/offline/tests` for reference. Active browser checks live under `tests/browser` and resolve their assets relative to the project.
