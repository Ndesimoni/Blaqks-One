# UI redesign baseline (UI0)

Evidence-based record of the connected CRM interface before the redesign packets begin.
Companion documents: [UI redesign plan](ui-redesign-plan.md) (outcome, scope, packets) and the
[UI pattern specification](ui-pattern-spec.md) (target contracts).

UI0 changed documentation and screenshots only. No application source, test, script, configuration,
migration or database record was modified, and nothing was committed or pushed.

## 1. Method

1. Read the packet and the full plan before touching anything.
2. Inventoried the connected shell, navigation, route tables, permission map and stylesheet cascade
   from source.
3. Captured rendered evidence with the existing connected browser harness, in bounded runs, copying
   images out of `test-results-server/` immediately because that directory is wiped at the start of
   every run.
4. Classified every finding as `rendered`, `source` (read in code, not yet seen on screen) or
   `plan` (asserted by the plan, re-checked in the packet that owns it).
5. Recorded baseline suite failures separately from anything this packet could cause.

## 2. Environment

| Item               | Value                                                                                                                                                                                                                                                                    |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Branch / HEAD      | `feature/connected-crm` at `ab4b029` ("Show your own company's requests on the marketplace board, marked 'Your company'")                                                                                                                                                |
| Frontend           | React 18 + Vite, `createHashRouter`, connected mode `VITE_CRM_MODE=server`                                                                                                                                                                                               |
| Backend            | Rust/Axum + sqlx + PostgreSQL 17, disposable project per browser run                                                                                                                                                                                                     |
| Harness            | `PLAYWRIGHT_CHANNEL=chrome node scripts/test-crm-api.mjs --browser-only <specs>`                                                                                                                                                                                         |
| Capture date       | Same working day as this document; every image listed below was produced by the runs in §3                                                                                                                                                                               |
| Owner working tree | Five uncommitted paths belonging to another agent (`docs/deepseek-delivery-plan.md`, `docs/handoff.md`, `src/i18n/catalogs/index.js`, `src/i18n/catalogs/en/marketplaceBoard.js`, `docs/deepseek-prompts/UI0-ui-redesign.md`). UI0 did not modify, stage or revert them. |

## 3. Evidence index

All images are **fresh** (captured for UI0). Theme suffix `light`/`dark`; viewport width in pixels;
height 900 for the full page and 844 for the phone-viewport page checks. Paths are relative to
`docs/screenshots/ui-redesign/`.

| Run                              | Files                                                                                                                  | Viewport × theme    | Role and state                                                         | Result                                                                        |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ------------------- | ---------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| A — `navigation.spec.js`         | `connected-390/768/1440-{light,dark}.png`, `navigation-desktop-{light,dark}.png`, `navigation-mobile-{light,dark}.png` | 390/768/1440 × both | Super Admin, workspace picker and sidebar open state                   | passed                                                                        |
| A — `responsive.spec.js`         | included above                                                                                                         | 390/768/1440 × both | Super Admin, reflow and no page overflow                               | passed                                                                        |
| B — `dashboard-layout.spec.js`   | `dashboard-admin-{390,1280}-{light,dark}.png` (8), `client-desk-admin-*` (8)                                           | 390/1280 × both     | Admin with seeded clients, properties, follow-ups, viewings, payments  | passed                                                                        |
| B — same spec, staff fixtures    | `dashboard-staff-*`, `client-desk-staff-*`                                                                             | 390/1280 × both     | Restricted staff member                                                | passed                                                                        |
| C — `profile.spec.js`            | `profile-{390,1280}-{light,dark}.png`                                                                                  | 390/1280 × both     | Admin, own account                                                     | one test failed (`profile-sessions-failure-1280.png`), the reflow test passed |
| C — `inbox-layout.spec.js`       | `inbox-empty-state-failure.png`                                                                                        | 1280 light          | Admin, channel not connected                                           | failed (no successful Inbox capture)                                          |
| D — `agreements.spec.js`         | `agreements-list`, `agreement-form-review`, `agreement-incoming`, `agreement-counter` × 390/1280 × both (16)           | 390/1280 × both     | Admin and counterparty, incoming/counter/ready states                  | passed                                                                        |
| D — `marketplace-apply.spec.js`  | `marketplace-{checklist,pending,decision,join,terms,mine,profile,approved}` × 390/1280 × both (32)                     | 390/1280 × both     | Applicant member, company Admin, Super Admin reviewer                  | passed                                                                        |
| D — `permissions-visual.spec.js` | `team-ticks-{enabled,disabled}`, `team-review` × 390/1280 × both (12)                                                  | 390/1280 × both     | Admin editing permissions; Super Admin reviewing a team                | passed                                                                        |
| D — `view-only-clients` fixtures | `view-only-clients-{390,1280}-{light,dark}.png` (4)                                                                    | 390/1280 × both     | Staff with read-only Clients access (row 0 shows the "View only" chip) | passed                                                                        |

Total: 96 images. Every image is reproducible with the command in its run row.

## 4. How a screen is composed today

`ServerApp` → `ServerSession` (identity) → `ServerDirectory` (workspace selection) →
`ServerWorkspace` (records) → `ServerShell` (header, sidebar, footer) → `ServerContent` (page).

- **Identity states** rendered before the shell: sign-in, `#/sign-up`, `#/activate-invitation`,
  `#/sign-out`, and the `ServerStatus` screens "Opening your CRM", "Unable to open the CRM",
  "Opening your workspace", "Unable to open your workspace", "Workspace access is restricted".
- **Entry redirect**: `/` sends the account to `/clients` (relationships), else `/properties`,
  else `/workspace` (`ServerDirectory.jsx:36`).
- **Workspace resolution**: `?workspace=<id>` is honoured for the Super Admin only; staff always
  resolve to their owning Admin's workspace; a rejected workspace shows the restricted state.
- **Deep links** bypass navigation: `#/shares/{id}` (`SHARE_ROUTE`) and
  `#/listing-shares/{id}` (`LISTING_SHARE_ROUTE`), both server-authorised.
- **Page guard**: `canOpenSection(user, route)` with `routePermissions` from
  `src/config/team.js:71`; an unauthorised route renders the "Access is restricted" panel rather
  than redirecting.
- **Not-connected fallback**: any route without a connected implementation renders
  `ServerUnavailableSection` ("NOT CONNECTED YET").
- **Query preservation**: `useWorkspaceNavigation` keeps `?q=` (search) and `?workspace=`.

## 5. Route manifest

`src/config/routes.js` composes three tables into `routes` (33 entries). `Dashboard` maps to `/`,
every other CRM name to kebab-case. Row 0 status: **C** = connected screen, **P** = connected
preview/panel, **U** = unavailable section, **D** = demo-only preview retained for company members.

| Group     | Route (path)                                                                      | Status | Component                                                                                                        | Permission                              | Evidence                  |
| --------- | --------------------------------------------------------------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------- | --------------------------------------- | ------------------------- |
| WORKSPACE | Dashboard (`/`)                                                                   | C      | `dashboard/ServerDashboard`                                                                                      | none (open)                             | `dashboard-*`             |
| WORKSPACE | Client desk (`/client-desk`)                                                      | C      | `clientDesk/ServerClientDesk`                                                                                    | `relationships`                         | `client-desk-*`           |
| WORKSPACE | Messages (`/messages`)                                                            | D      | unavailable for Super Admin only; members see Inbox                                                              | —                                       | `connected-1440-*` (chip) |
| WORKSPACE | CRM insights (`/crm-insights`)                                                    | C      | `insights/ServerInsights`                                                                                        | `reports`                               | —                         |
| SALES     | Leads (`/leads`)                                                                  | C      | `leads/LeadsPage` (view over Clients)                                                                            | `relationships`                         | `dashboard-*` links       |
| SALES     | Clients (`/clients`)                                                              | C      | `records/RecordsPage`                                                                                            | `relationships`                         | `view-only-clients-*`     |
| SALES     | Contacts (`/contacts`)                                                            | C      | `contacts/ContactsPage`                                                                                          | `relationships`                         | —                         |
| SALES     | Properties (`/properties`)                                                        | C      | `properties/PropertyDirectory`                                                                                   | `properties`                            | `connected-1440-*`        |
| SALES     | Deals (`/deals`)                                                                  | C      | `finance/FinanceContent`                                                                                         | `finance`                               | —                         |
| SALES     | Agreements (`/agreements`)                                                        | C      | `agreements/ServerAgreements`                                                                                    | shared with team                        | `agreements-*`            |
| SALES     | Marketplace (`/marketplace`)                                                      | C      | `marketplace/ServerMarketplace`                                                                                  | membership                              | `marketplace-*`           |
| SALES     | Follow-ups, Viewings, Shortlist, Interaction log, Client care                     | C      | `RecordsPage` / shortlist                                                                                        | `schedule`, `properties`                | `dashboard-*`             |
| FINANCE   | Payments, Expenses                                                                | C      | `finance/FinanceContent`                                                                                         | `finance`                               | —                         |
| FINANCE   | Date search (`/date-search`), Performance (`/performance`)                        | C      | `dateSearch/`, `performance/`                                                                                    | `reports`                               | —                         |
| RESOURCES | Calculators, Guide                                                                | C      | `calculators/`, `guide/`                                                                                         | none (open)                             | —                         |
| SETTINGS  | Team & access (`/team-access`)                                                    | C      | `server-team/ServerTeamPage`                                                                                     | Admin scope                             | `team-*`                  |
| SETTINGS  | My profile (`/my-profile`)                                                        | C      | `profile/ServerProfile`                                                                                          | own account                             | `profile-*`               |
| SETTINGS  | Channels (`/channels`)                                                            | C      | `channels/ServerChannels`                                                                                        | own account                             | —                         |
| SETTINGS  | Workspaces (`/workspaces`)                                                        | U      | `ServerUnavailableSection`                                                                                       | Admin and Super Admin (`canManageTeam`) | —                         |
| SETTINGS  | Team activity (`/team-activity`)                                                  | C      | `activity/ServerActivity`                                                                                        | none (open)                             | —                         |
| SETTINGS  | Marketplace applications (`/marketplace-applications`)                            | C      | `marketplace/…Applications`                                                                                      | Super Admin                             | `marketplace-decision-*`  |
| CONNECTED | Inbox (`/inbox`), Inbox rules (`/inbox-rules`), My mailbox (`/my-mailbox`)        | C      | `inbox/`, `inboxRules/`, `mailbox/`                                                                              | channel grants                          | failure image only        |
| CONNECTED | Team chat (`/team-chat`)                                                          | C      | `chat/ServerTeamChat`                                                                                            | team                                    | —                         |
| CONNECTED | Google sign-in (`/oauth/google`)                                                  | P      | `mailbox/GoogleReturn`                                                                                           | own account                             | —                         |
| UTILITY   | `#/sign-up`, `#/activate-invitation`, `#/sign-out`, `/workspace`, `*` → not found | C      | `ServerSession`, `InvitationActivation`, `ServerSignOut`, `ServerUnavailableSection`, `FeatureRoutes` `NotFound` | —                                       | —                         |

Files outside this manifest render the "Access is restricted" panel with the sentence
"Reports and messaging connections are still being developed.", which is no longer true
(`ServerContent.jsx:57-65`).

## 6. Overlay manifest

34 dialog/drawer components. Families and owners:

| Family           | Components                                                                                                          | Notes                                    |
| ---------------- | ------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| Shared primitive | `components/ui/Drawer.jsx`                                                                                          | one drawer shell, two widths in the plan |
| Record editing   | `app/WorkspaceDialogs.jsx`, `features/server/ServerDialogs.jsx`, `features/server/ImportDialog.jsx`, `RecordDrawer` | record create/edit, import review        |
| Workspace        | `WorkspacePickerDialog`, `WorkspacePickerResults`, `WorkspacePickerDialog`                                          | Super Admin workspace switching          |
| Sharing          | `shares/ShareDialog`, `shares/ShareSentDialog`, `listingShares/OutsideShareDialog`                                  | R1/R2a flows                             |
| Agreements       | `agreements/*` review and counter forms                                                                             | evidence-bearing revisions               |
| Marketplace      | `MarketplaceProfileDialog`, `MarketplaceMineDialogs`                                                                | join, profile, close                     |
| Finance          | 16 dialogs under `finance/` (deal actions, handover, split, earn/unearn, void, reject, revise)                      | dense single-purpose forms               |
| Team             | `TeamMemberDialog`, `TeamArchiveDialog`, `SeatLimitDialog`, `team/PreviewLinkDialog`                                | admin-only                               |
| Messaging        | `messaging/MessageComposerDialog`, `MessagePreviewDialog`                                                           | composer and preview                     |
| Assignment       | `assignment/BulkReassignDialog`, `assignment/HandoffDialog`                                                         | staff handover                           |
| Team chat        | `chat/GroupMembersDialog`                                                                                           | groups                                   |

## 7. Role and view-state matrix

| Viewer           | Navigation shown                                                                                                             | Records                                          | Evidence                                            |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ | --------------------------------------------------- |
| Company Admin    | four CRM groups + team settings; Inbox and Team chat in the Messages slot                                                    | full CRUD in own workspace                       | `dashboard-admin-*`, `team-*`, `marketplace-mine-*` |
| Restricted staff | same groups, sections filtered by grants; read-only pages add a "View only" chip                                             | assigned-only, may be read-only                  | `view-only-clients-*`                               |
| Super Admin      | CRM groups + `Workspaces`, `Team activity`, `Marketplace applications`; **Messages (not connected)** where members see Inbox | read-only across teams, own workspace by default | `connected-1440-*`, `marketplace-decision-*`        |
| Archived team    | frozen workspace, read-only banner in every connected section                                                                | read-only                                        | source only                                         |

## 8. Findings

Severity: **S1** blocks a core task at a tested viewport, **S2** wastes attention or space in daily
use, **S3** polish. `rendered` = seen in an image below; `source` = read in code.

| ID   | Sev | Source   | Finding and evidence                                                                                                                                                                                                                                                                                                                                                            |
| ---- | --- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| B-01 | S1  | rendered | **Clients directory is not usable on a phone.** At 390 the table stays a two-column table; `view-only-clients-390-light.png` clips the name (`… for wr`) and hides stage, owner and row actions with no scroll cue. At 1280 the last column is clipped (`MAXIMUM BU…`) inside a card, again without an affordance.                                                              |
| B-02 | S1  | rendered | **Duplicate page intro.** The shell draws the title and description, then the page repeats the same description inside a "Total clients" / "Total properties" summary card. `view-only-clients-1280-light.png` and `connected-1440-light.png` show "Manage relationships, qualification, budgets, and conversion." twice; the count sits in a card instead of beside the title. |
| B-03 | S1  | rendered | **Records come last on Property portfolio.** Banner → title → summary card → six category tiles (all zero for an empty workspace) → count/search/view toggle → Assignee → expanded `Filter properties` panel → records. Six select controls are open by default. `connected-1440-light.png`.                                                                                    |
| B-04 | S2  | rendered | **Dashboard prioritises onboarding over today's work.** On 390: welcome hero, then a five-step "Get started" checklist (~450 px), then "Your business, at a glance"; "Your priorities" and "Upcoming viewings" appear after finance and a nine-row "Records in view", roughly 4,000 px down. `dashboard-admin-390-light.png`.                                                   |
| B-05 | S2  | rendered | **Navigation does not separate daily work, company settings, personal account and platform administration.** Four CRM groups (20 items) plus a separate SETTINGS group of six unrelated entries; the Super Admin sees the same list with `Workspaces` and `Marketplace applications` appended. `connected-1440-light.png`, `ServerNavigationSettings.jsx`.                      |
| B-06 | S2  | rendered | **Availability chrome competes with task chrome.** "Not connected" chips on nav items, a two-line legend inside the sidebar ("Not connected sections show their current availability…"), and "NOT CONNECTED YET" panels. Two message entries coexist: `Messages` (Super Admin, not connected) and `Inbox`/`Team chat` (members). `ServerNavigationGroups.jsx`.                  |
| B-07 | S2  | rendered | **The shell footer is wrong.** "Connected CRM · Messaging and public publication are not connected yet." (`ServerShell.jsx:128`) while Inbox, Inbox rules, Channels, Team chat, My mailbox, Agreements and Marketplace are all connected; only public publication is outstanding.                                                                                               |
| B-08 | S2  | rendered | **The Super Admin workspace banner repeats itself and costs vertical space.** "Super Admin workspace" appears in the header, as the banner title and as the banner select value, pushing the page title ~110 px down. `connected-1440-light.png`.                                                                                                                               |
| B-09 | S2  | rendered | **Counts are stated three times.** "1 Total clients", "Showing 1–1 of 1 records" and a pager reading "1 / 1" on one page. `view-only-clients-1280-light.png`.                                                                                                                                                                                                                   |
| B-10 | S2  | rendered | **Actions of different scope share one heading row.** Page-level "Add property" sits beside workspace-level "Import saved records" in the heading area (`connected-1440-light.png`).                                                                                                                                                                                            |
| B-11 | S3  | rendered | Completed checklist steps are struck through, which reads as "cancelled" rather than "done" (`dashboard-admin-390-light.png`).                                                                                                                                                                                                                                                  |
| B-12 | S2  | rendered | Empty collections still render analytics furniture: six zeroed category tiles, a count, a view toggle and a pager around a single empty state (`connected-1440-light.png`).                                                                                                                                                                                                     |
| B-13 | S2  | source   | `/workspaces` and the demo Messages route render the unavailable panel, whose copy promises work that has since shipped (`ServerContent.jsx:57-65`).                                                                                                                                                                                                                            |
| B-14 | S2  | rendered | Team permission editing is a dense tick matrix with no grouping by module (`team-ticks-enabled-1280-*.png`).                                                                                                                                                                                                                                                                    |
| B-15 | S2  | rendered | My profile mixes identity, preferences, sender connections and signed-in devices in one undifferentiated column; the baseline run showed an empty signed-in-device list (`profile-1280-*.png`, `profile-sessions-failure-1280.png`).                                                                                                                                            |
| B-16 | S3  | rendered | The marketplace join/status screens place membership terms and commitments above the membership state, so a member cannot see at a glance whether they are approved (`marketplace-approved-390-*.png`).                                                                                                                                                                         |
| B-17 | S2  | source   | Cascade fragmentation: `src/styles/index.css` imports 18 sheets which fan out to 85 sheets (3,669 lines); components import a further 115 sheets (10,614 lines). Selectors such as `.panel`, `.card` and `.eyebrow` are redefined across both sets, so a visual change needs duplicate edits.                                                                                   |

## 9. Implementation impact map

- **Single ordered entry point.** `src/index.css` → `src/styles/index.css` → 18 imports
  (foundation, workspace, responsive, property-collection, theme, property-responsive,
  listing-media, frontend, leads, calendar, auth, team, messaging, overflow, workspaces, system,
  demo-photos, i18n). Every one of the 85 sheets in `src/styles/` is reachable through a nested
  `@import` (verified: zero unreferenced sheets). Order matters and must be preserved while
  splitting.
- **Feature sheets** (115 files, 10,614 lines) are imported by the component that owns the screen
  (`features/server/dashboard/dashboard.css`, `marketplace/marketplace-requests.css`, …). A packet
  may only touch the sheets of screens it owns.
- **Shared primitives** live in `components/ui` (`Button`, `Icon`, `Drawer`, `OverflowList`,
  `Unveil`, `Loading`) and `components/layout`; they serve both the frozen demo and connected mode.
  Changing a primitive is a cross-mode change and needs a demo smoke check (`npm run build` plus a
  visual diff of one demo screen), even though the demo takes no new features.
- **Structure to respect**, not rewrite: `.shell` grid, `.sidebar` (dark green), `.topbar`,
  `.content`, `.footer`, `.panel`, `.card`, `.eyebrow`, `.page-head`, `.toolbar`, `.table-*`.
  New patterns should extend these names rather than introduce a parallel system.
- **Oversized files** encountered while planning: `src/styles/workspace.css` and
  `src/styles/foundation.css` exceed the 150-line rule and are already tracked by
  `check:lines:ci`. A packet that must edit one splits it along the pattern boundaries defined in
  the pattern specification and reports the split.
- **Prospective write sets** (refined by each packet, not authorised here): UI1 owns the shell
  (`ServerShell`, `ServerNavigation*`, `ServerHeader`, `navigation.css`, `workspace.css` chrome
  rules and the footer string); UI2 owns `RecordsPage` + Clients/Leads directory chrome and the
  `view-only-clients` browser spec; UI3 owns `PropertyDirectory`. Every packet re-runs
  `tests/server-browser/navigation.spec.js`, `responsive.spec.js` and `permissions-visual.spec.js`
  plus the specs it touches.

## 10. Baseline checks

| Check                                                                           | Result                                                                                                                                                  |
| ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `navigation.spec.js` + `responsive.spec.js`                                     | 3 passed                                                                                                                                                |
| `dashboard-layout.spec.js` (Admin and staff fixtures)                           | passed                                                                                                                                                  |
| `profile.spec.js`                                                               | "My profile reflows" passed; **"Signed-in devices" failed** (expected 3, got 0)                                                                         |
| `inbox-layout.spec.js`                                                          | **failed**: `.inbox-list-pane .inbox-state` "Connect a channel to start" missing                                                                        |
| `marketplace-apply.spec.js`, `agreements.spec.js`, `permissions-visual.spec.js` | 5 passed                                                                                                                                                |
| `properties.spec.js`                                                            | **failed**: `.media-photo-hero img` has `naturalWidth` 0 (media not loading)                                                                            |
| UI0 documents                                                                   | `npx prettier --check` passed on this document, the plan and the pattern spec; all relative links and heading anchors resolve; `git diff --check` clean |

The three failures are pre-existing: UI0 wrote no application code and the failing assertions are in
media loading, Inbox channel state and device sessions. They must stay red until a packet owns them;
a packet that turns one green reports it.

## 11. Evidence gaps

Captured, reusable, but missing from the current set. Each is a capture task for the owning packet,
not a licence to describe unseen screens as if they were observed:

- Clients directory and client drawer as **Admin with records** (desktop table, phone cards, editor).
- Property directory with records and the property detail drawer (the run failed on media loading).
- A successful Inbox layout, Inbox rules and My mailbox.
- Payments, Expenses and Deals lists with records.
- Settings → Workspaces (Super Admin) and the import review dialog.
- Archived-workspace read-only banner.

## 12. Preservation guarantees

UI0 asserts nothing about behaviour it did not observe. Every packet keeps: hash-route paths and
names, `?q=`/`?workspace=` handling, `canOpenSection` gates, workspace resolution rules, storage keys
and workbook column keys, English-only copy through `useI18n()` with flat dotted keys, and the
frozen demo. Findings above state a problem and a proposed pattern; the packet that owns a screen
decides the implementation and must re-verify the finding in the same session before changing code.
