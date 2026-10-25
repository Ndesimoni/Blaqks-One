# UI pattern specification — target contracts (UI0)

Proposed, implementation-ready contracts for the connected CRM redesign. Companion to the
[UI redesign plan](ui-redesign-plan.md) (scope, packets) and the
[UI redesign baseline](ui-redesign-baseline.md) (current evidence, findings `B-01`…`B-17`).

**Status: target, not implemented.** UI0 changed documentation and screenshots only. Every
packet that implements a pattern re-verifies the finding that motivates it in the same session
and keeps the preservation contracts in
[plan §7](ui-redesign-plan.md#7-non-negotiable-architecture-and-data-contracts).

Values marked **current** were read from source at `ab4b029`; values marked **target** are
proposals to be proven in the pilot, not approved values.

## 1. Verified current measurements

| Surface            | Current                                                  | Source                                                          | Target                                                   |
| ------------------ | -------------------------------------------------------- | --------------------------------------------------------------- | -------------------------------------------------------- |
| Sidebar            | 255px fixed, `main-area` offset 255px                    | `src/styles/layout/sidebar-brand.css`, `topbar.css`             | 240–256px (already met; UI2 changes grouping, not width) |
| Top bar            | 79px                                                     | `src/styles/layout/topbar.css`                                  | 60–64px                                                  |
| Content frame      | `max-width: 1650px`, padding `30px 37px 19px`            | `src/styles/layout/topbar.css`                                  | keep max width; gutters 32/24/16                         |
| Page heading       | `.page-heading` flex, 9px eyebrow, `margin: 3px 0 26px`  | `src/styles/layout/page-heading.css`                            | one `h1`, no repeated eyebrow                            |
| Desktop navigation | sidebar above 1050px; `Drawer` below                     | `ServerNavigation.jsx` (`useMediaQuery('(max-width: 1050px)')`) | unchanged breakpoint                                     |
| Phone treatment    | 750px (`dialog` full screen, stacked controls)           | `src/styles/ui/dialog-behavior.css`, `system/responsive*.css`   | unchanged breakpoint                                     |
| Inbox panes        | 1440+ / 900–1439 / under 900                             | `src/features/server/inbox/inbox-layout.css`                    | unchanged                                                |
| Dialog             | 840×800 standard, 1040×900 wide, full screen under 750px | `src/styles/ui/dialog-behavior.css`                             | keep; retire the dead `545px` width                      |
| Motion             | `--duration: 160ms`, `--ease`                            | `src/styles/foundation.css`                                     | keep; reduced-motion honoured                            |

`.detail-drawer { width: 545px }` in `src/styles/ui/drawer.css` is overridden by
`.modal-centered > .drawer` today. Do not build a new layout on that class; either delete it in
the packet that touches drawer CSS or give detail and editor drawers an explicit size contract.

## 2. Target navigation

Display groups only. Route names, paths, `canOpenSection` predicates, `?workspace=` and `?q=`
handling do not change.

### 2.1 Destination map

| Group                     | Destinations (existing route → path)                                                                                                                                          |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Overview                  | Dashboard → `/`                                                                                                                                                               |
| Relationships             | Leads → `/leads`, Clients → `/clients`, Contacts → `/contacts`, Client desk → `/client-desk`                                                                                  |
| Inventory & collaboration | Properties → `/properties`, Shortlist → `/shortlist`, Marketplace → `/marketplace`, Agreements → `/agreements`                                                                |
| Work & communication      | Follow-ups → `/follow-ups`, Viewings → `/viewings`, Inbox → `/inbox`, Team chat → `/team-chat`, Interaction log → `/interaction-log`, Client care → `/client-care`            |
| Finance & reporting       | Deals → `/deals`, Payments → `/payments`, Expenses → `/expenses`, Performance → `/performance`, Date search → `/date-search`, CRM insights → `/crm-insights`                  |
| Resources                 | Calculators → `/calculators`, Guide → `/guide`                                                                                                                                |
| Company settings          | Team & access → `/team-access`, Team activity → `/team-activity`, Channels → `/channels`, Inbox rules → `/inbox-rules`, Workspaces → `/workspaces` (Admin only in this group) |
| Personal account          | My profile → `/my-profile`, My mailbox → `/my-mailbox`, My activity → `/team-activity` (staff label, same route)                                                              |
| Platform administration   | Workspaces → `/workspaces` (Super Admin only in this group), Marketplace applications → `/marketplace-applications`                                                           |

`Workspaces` is authorized for both roles by `canManageTeam` (`access.js`). Render it **once per
viewer**: Company settings for an Admin, Platform administration for the Super Admin. A Super
Admin must not see two Workspaces entries.

`Messages → /messages` is a frozen demo preview. Company members already see Inbox (and Team
chat) in its slot; the Super Admin sees the "not connected" panel whose copy claims messaging is
unbuilt. Proposed: omit `Messages` from connected navigation for every role and keep the route
reachable with truthful state copy. This is a visible change to the Super Admin's list and needs
pilot review, not a silent deletion.

### 2.2 Desktop map

```text
┌ 255px sidebar ────────────────┐   Top bar 60–64px: company · account · theme
│ Brand                         │
│ ── Overview ─────────────     │
│   Dashboard                   │
│ ── Relationships ────────     │
│   Leads · Clients · Contacts  │
│   Client desk                 │
│ ── Inventory & collaboration  │
│ ── Work & communication ──    │
│ ── Finance & reporting ───    │
│ ── Resources ─────────────    │
│                               │
│ ── Personal account ──────    │  pinned above settings
│   My profile · My mailbox     │
│ ── Company settings ──────    │  (roles filtered)
│ ── Platform administration ─  │  (Super Admin only)
└───────────────────────────────┘
```

Group order is fixed: Overview, Relationships, Inventory & collaboration, Work & communication,
Finance & reporting, Resources, Personal account, Company settings, Platform administration.
Empty groups disappear; a group with one item still shows its label only if a sibling group could
appear for another role (keeps positions stable between roles). Active route's group stays open.
Badges keep their current meaning (waiting answers, unread chat/inbox); nothing is fetched to
decorate the sidebar.

### 2.3 Mobile map

Same destinations and order in the existing `Drawer` (`placement="side"`). One nesting level,
collapsed groups by default except the active one. Close on select, restore focus to the menu
button. Do not add a second navigation surface; the company identity stays in the top bar.

### 2.4 Role examples

| Viewer             | Sees                                                                                                                                                                                                                                         | Omits                                                            | Notes                                                                                                                                                                                                               |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Company Admin      | All groups; Company settings with Team & access, Team activity, Channels, Inbox rules, Workspaces                                                                                                                                            | Platform administration                                          | Finance and reports follow grants                                                                                                                                                                                   |
| Restricted staff   | Overview, Relationships, Inventory & collaboration, Work & communication, Finance & reporting, Resources, Personal account (My activity is the staff label for the Team activity route); My mailbox only with an email grant                 | Every Company settings entry, Platform administration            | Sections filtered by `routePermissions`; read-only pages keep the View only chip                                                                                                                                    |
| Super Admin        | Overview, Relationships, Inventory & collaboration (no Marketplace), Work & communication (Messages, not Inbox/Team chat), Finance & reporting, Resources, Personal account, Company settings (Team, Team activity), Platform administration | Channels, Inbox rules, Inbox, Team chat, Agreements, Marketplace | Workspace switcher stays in the workspace banner; no company Inbox, chat or agreement terms. Verified in UI2: `canManageTeam` also lets the Super Admin open Team and Team activity, so Company settings is present |
| Archived workspace | Same as its role, read-only                                                                                                                                                                                                                  | Action-producing entries that cannot work                        | Persistent read-only banner stays conspicuous above the page title                                                                                                                                                  |

## 3. Layout templates

| Family        | Composition                                                         | Owner today                                                                            |
| ------------- | ------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Directory     | Heading → toolbar → active filters → records → pagination           | `features/records/RecordsPage.jsx`, `features/properties/PropertyDirectory.jsx`        |
| Overview      | Heading/scope → priorities → selected metrics → supporting analysis | `features/server/dashboard/ServerDashboard.jsx`                                        |
| Workspace     | Pane navigation → thread → optional context, full height            | `features/server/inbox/ServerInbox.jsx`, `chat/ServerTeamChat.jsx`                     |
| Review/detail | Identity/state → required response → facts/terms → history          | `components/ui/Drawer.jsx` consumers, `agreements/`, `finance/`                        |
| Settings      | Scope/title → section nav → constrained form → save feedback        | `profile/ServerProfile.jsx`, `server-team/ServerTeamPage.jsx`, `channels/`, `mailbox/` |
| Utility       | Purpose → inputs → computed result beside an explanation            | `calculators/`, `dateSearch/`, `guide/`                                                |
| Identity      | Focused form → validation/progress → recovery/next step             | `ServerSession`, `ServerSignIn`, `signup/`, `InvitationActivation`                     |

Rules: one `h1` per ordinary page; full-height messaging keeps its own accessible headings and no
shell footer; a settings page is one surface with section navigation, not one long column.

## 4. Tokens and both-theme guidance

Reuse the semantic palette in `src/styles/foundation.css` (light) and
`src/styles/theme/surfaces.css` (dark). Do not copy literals into feature CSS.

| Intent          | Light                                     | Dark                       |
| --------------- | ----------------------------------------- | -------------------------- |
| Page background | `--bg` `#f3f6f4`                          | `#101a15`                  |
| Surface         | `--panel` `#fff`                          | `#19271f`                  |
| Primary action  | `--primary` `#28523d`                     | `#d6b17d` (gold, dark ink) |
| Accent / links  | `--accent` `#80603a`                      | `#dfbd8d`                  |
| Body text       | `--ink` `#1e2e2d`                         | `#dce8df`                  |
| Supporting text | `--muted` `#607267`                       | `#a8baae`                  |
| Hairline        | `--line` `#dce5df`                        | `#34483b`                  |
| Hover           | `--hover` `#edf3ef`                       | `#24372b`                  |
| Focus           | `--focus` `#477a60` + `--focus-ring`      | `#dfbd8d` + ring           |
| Danger          | `--danger` `#a33b37` / `--danger-surface` | `#ffb3a9` / `#3c2926`      |

Proposed additions, only if a repeated need appears (not in UI1 until proven):

| Token           | Target                       | Use                                   |
| --------------- | ---------------------------- | ------------------------------------- |
| `--page-gutter` | 32 / 24 / 16px by breakpoint | content and dialog-body alignment     |
| `--control-h`   | 40px desktop, 44px touch     | toolbar and form controls             |
| `--stack-gap`   | 16px                         | vertical rhythm inside a page surface |

Typography target: page title 28–32px desktop / 24–28px phone; section 18–20px; body 14–16px;
meta 12–13px. Tabular numerals for money and counts; monetary columns right-aligned. No new font
service, icon package or gradient decoration.

Contrast must be **measured** on the rendered pair, not assumed: body text ≥4.5:1, large text
≥3:1, visible control borders/focus ≥3:1, in both themes. The tightest common pairs to check
first are `--muted` on `--panel`, `--muted` on `--surface-subtle`, sidebar labels on `--sidebar`,
and gold primary on dark surfaces.

## 5. Component and state contracts

Each contract lists anatomy, responsive rule, keyboard rule and states. Current owners are the
files to change in the named packet.

### 5.1 Page heading

Anatomy: `h1` title; optional one-line context (scope or company); authorized count as metadata
next to the title; one dominant action; secondary actions in a labelled menu. Action order:
primary first on the right, destructive never adjacent. Phone: title and count share a row, the
primary action moves into the toolbar row, secondary actions collapse into `Actions`.

Remove the repeated eyebrow and the duplicate description inside a summary card (`B-02`).
Loading: keep the heading; skeleton the count. Read-only: show the View only chip in the heading
area, never in the record row.

### 5.2 Directory toolbar

Anatomy: search (labelled), essential filter, assignee where the module supports it, `Filters (n)`
with the active count, view toggle for Properties only, `Data` menu for existing export/import
actions. One row at 1280; wrapping to two rows at 390 with search full width. Filter changes reset
the page. Advanced panels start closed and keep their values when closed.

### 5.3 Active filters

Removable chips plus `Clear filters`; only rendered when at least one filter is active. Chips are
buttons with accessible names (`Remove Dubai filter`). Filter state is preserved through
pagination, sorting and drawer open/close.

### 5.4 Records: table (desktop) and card list (phone)

Desktop keeps the existing sortable `data-table`, with identity first, then requirement/status,
owner, and a labelled action cell. Wide tables scroll inside a labelled container; the page must
not overflow.

Phone replaces the table with one card per record: identity and stage first, then the two most
scannable facts, then labelled actions. Do not keep a two-column table that clips columns (`B-01`).
Twelve records per page, unchanged.

### 5.5 Selection bar

Appears only after selection, shows the count and only the bulk actions the server allows, offers
`Clear selection`, and never changes selection silently across pages.

### 5.6 Pagination

One pager per directory. The page-level record count is stated once; do not repeat it as a total
card, a range line and a pager label (`B-09`). Disabled arrows are visually and programmatically
disabled.

### 5.7 Detail and editor drawer

Detail: identity block, state/next action, grouped facts, related records, then actions. Primary
action is Edit or the required response; Delete stays separated with the existing confirmation.
Editor: grouped fields, stepper only for long forms, sticky header and footer, scrollable body,
inline errors focused on first invalid field, duplicate submits disabled, drafts and versions
retained on conflict.

Phone: existing full-screen drawer; close and primary action reachable without scrolling the
body; the virtual keyboard must not cover the focused field or the footer.

### 5.8 State panel

One component family for: loading (skeleton in place), no records (permitted create action),
filtered-empty (clear filters), error with retry, permission denial, conflict/version, archived
read-only, and unavailable capability. Copy states what is true; no demo fallback, no speculative
success. Each state names the affected scope.

### 5.9 Settings sections

Scope title, section navigation (Details, Guidance, Security, Sessions, Company), one constrained
form width, save feedback attached to the Save control. Company information is visually separate
from personal account data (`B-15`).

### 5.10 Full-height messaging

Unchanged pane model: three panes ≥1440, two 900–1439, single pane with explicit back below 900.
No shell heading or footer. Composer grows with text, attachments stay inside it, send/note modes
keep their meaning, and queued/sent/failed states remain attached to the message.

## 6. Wireframes

### 6.1 Shell — desktop 1280 and phone 390

```text
1280
┌ 255 sidebar ┬──────────────────────────────────────────────────────────┐
│ brand       │ Company · workspace            theme · account           │ 60–64
│ groups      ├──────────────────────────────────────────────────────────┤
│ active      │ Clients · 1 client                            [Add client]│ heading
│ route       │ [Search clients…] [Status] [Assigned to] [Filters] [Data] │ toolbar
│             │ [Dubai ×] [Buying ×]                    Clear filters    │ chips
│             │ NAME            REQUIREMENT      STAGE      OWNER  ACTIONS│
│             │ …                                                           │
│ personal    │ Showing 1–1 of 1                        [Previous][Next] │
│ settings    │ © year · concise, accurate footer                            │
└─────────────┴──────────────────────────────────────────────────────────┘

390
┌──────────────────────────────────────────┐
│ [Menu] Company              [Account]    │ 56–60
│ Clients · 1 client          [Add client] │ heading (no eyebrow)
│ [Search clients…]      [Filters] [Data]  │ toolbar
│ [Dubai ×] [Clear]                        │ only when filtering
│ ┌ Record identity · stage ─────────────┐ │  ≤520px to first record
│ │ Requirement · owner                  │ │
│ │ [Open] [Message] [More]              │ │
│ └──────────────────────────────────────┘ │
│ [Previous] [Next]                        │
└──────────────────────────────────────────┘
```

### 6.2 Clients directory — 390×844 density budget

| Band                               | Budget                                                          |
| ---------------------------------- | --------------------------------------------------------------- |
| Top bar                            | 56                                                              |
| Page heading (title + count + Add) | 64                                                              |
| Toolbar (search, Filters, Data)    | 56                                                              |
| Active-filter row                  | 0 (none) / 32 (present)                                         |
| First record top                   | **≈176 (no filters) / ≈208 (filters)**                          |
| Hard check                         | first record or state panel `getBoundingClientRect().top ≤ 520` |

Justified exceptions: archived read-only banner, and a genuinely required setup gate. Do not meet
the budget by shrinking type below the stated sizes, hiding the Add action, or removing the count.

### 6.3 Client details and editor

```text
Detail (840×800 desktop; full screen ≤750)    Editor
┌──────────────────────────────┐              ┌──────────────────────────────┐
│ CLIENTS · RECORD DETAILS   × │              │ Edit client                × │
│ Full name                    │              │ [Details][Requirement][Links]│
│ C-001 · 24 fields            │              │ Identity section             │
├──────────────────────────────┤              │   fields, inline errors      │
│ State / next action          │              │ Requirement section          │
│ [Start message]              │              │   fields                     │
│ Contact · Requirement        │              │ Related records              │
│ Related records / history    │              ├──────────────────────────────┤
├──────────────────────────────┤              │ Delete            [Save]     │
│ [Delete]            [Edit]   │              └──────────────────────────────┘
└──────────────────────────────┘
```

State: read-only hides Edit/Delete and explains why; kept/shared records show their chip and no
edit/message controls beyond current permissions.

### 6.4 Properties stress check

Target: heading with count and `Add property` → toolbar (search, purpose segmented control,
`Filters (n)`, grid/list toggle, `Data`) → active chips → grid of 12. Category tiles collapse into
the purpose control or one compact row; the advanced filter panel starts closed (`B-03`, `B-12`).
Grid and table share dataset and page. Media failures show a labelled fallback without altering
the stored record. Card order: media → price → title/location → key facts → status/actions.

### 6.5 Inbox stress check

Target: identical heading-free panes as today, with list/thread/context hierarchy, sticky
composer, and states for no channel, empty thread, failed attachment and failed send. Loading a
thread must not shift the composer. The phone back control is the only navigation between panes.
Capture the missing successful Inbox states in the packet that owns them (baseline §11).

## 7. Pilot acceptance — Clients (UI3)

Rendered evidence at 390×844 and 1280×800, both themes, Admin with seeded clients, restricted
staff with assigned-only read-only clients, and a Super Admin viewing another company.

1. First record or state starts ≤520px from the top at 390×844; no horizontal page overflow.
2. One `h1`, one count statement, one primary action; no repeated description (`B-02`).
3. Search, tabs/status filter, assignee filter and pagination keep their current effects and reset
   the page; selections and query survive drawer open/close.
4. Table at 1280 shows all preferred columns without clipping; phone shows cards with every
   essential fact and the row actions reachable.
5. Create, edit, delete, assignment and conflict paths keep their server authorization, version
   handling and messages; view-only and kept records stay view-only and labelled.
6. Drawer focus trap, Escape, opener restoration, unsaved guard and full-screen phone layout
   verified by keyboard.
7. Loading, empty, filtered-empty, error and denial states are distinguishable and truthful.
8. New copy exists only in the English catalogue with flat dotted keys; `npm run check:i18n`
   passes.

## 8. Accessibility, keyboard and resilience criteria

- Keyboard: every action reachable in DOM order; visible focus not obscured by sticky bars; Tab
  cycles inside an open drawer; Escape closes only the topmost dialog; focus returns to the opener.
- Semantics: landmarks (`nav`, `main`), one `h1`, real table headers with sort state, labelled
  controls, status announced via `role="status"`, errors associated with fields.
- Targets: primary touch controls 44px; compact desktop controls may stay denser but keep adequate
  separation. No icon-only control without an accessible name.
- Status is never colour-only: stage/amount/approval states carry text.
- Long content: 60-character names, long company names, 7-digit prices and long validation text
  without clipping or overlap.
- Zoom and reflow: 200% zoom and 320px width without loss of function; necessary table scrolling
  stays inside a labelled container.
- Motion: honour `prefers-reduced-motion`; no essential information conveyed by animation.

## 9. Ownership, sizing and packet allowlists

### 9.1 Ownership map

| Area                        | Single owner                                | Notes                                                                                                 |
| --------------------------- | ------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Shared primitives           | one coordinator across `src/components/ui/` | serves the frozen demo too; `npm run build` plus one demo screen smoke check                          |
| Shared styles               | same coordinator                            | `src/styles/index.css` order, `styles/system/*`, `styles/records/*`, `styles/layout/*`, `styles/ui/*` |
| Connected navigation config | shell packet                                | new connected-only definition; keep `config/navigation.js` for the demo                               |
| Catalogue registration      | same coordinator                            | `src/i18n/catalogs/index.js`; flat dotted keys in `src/i18n/catalogs/en/*.js`                         |
| Feature presentation        | each feature packet                         | only the folders listed in its allowlist                                                              |

### 9.2 Oversized-file strategy

`npm run check:lines` remains the inventory; `npm run check:lines:ci` is the gate for changed
files. Split a touched oversized file along these boundaries before adding rules, preserving
cascade order:

| File                                 | Split by                                          |
| ------------------------------------ | ------------------------------------------------- |
| `src/styles/workspace.css`           | shell chrome / page heading / toolbar / states    |
| `src/styles/foundation.css`          | tokens / reset / base typography                  |
| `src/styles/team.css`                | member directory / roles and grants / invitations |
| `src/styles/property-collection.css` | summary / toolbar / filters / results             |
| `src/styles/responsive.css`          | layout reflow / control reflow                    |

No numbered fragments, no compression, no blanket `!important`.

### 9.3 UI1 — foundations

- Write: selected `src/components/ui/*.jsx` (Button, Badge, Pagination, Empty, TitleSection,
  Metric, LabelValue, `OverflowList` only if a proven gap), matching `src/styles/system/*.css`,
  `src/styles/ui/*.css`, new/changed English catalogue files and registration, focused tests.
- Do not: touch shell, page layouts, routes, data hooks, services or the demo's behaviour.
- Tests: `npm test`, `npm run build`, `npm run check:i18n`, `npm run check:lines:ci`,
  `npm run check:boundaries`, `tests/unit/overflow.test.js`, `tests/unit/i18n-*.test.js`.
- Acceptance: controls render in both themes, focus visible, no visual regression on one demo
  screen, no new dependency.

### 9.4 UI2 — connected shell

- Write: `src/features/server/ServerShell.jsx`, `ServerHeader.jsx`, `ServerNavigation*.jsx`,
  `navigation.css`, `shell.css` chrome rules, one new connected navigation definition, footer
  copy, catalogue strings, related tests.
- Do not: change route names/paths, `canOpenSection`, workspace resolution, badges' data sources,
  full-height pane behaviour or the demo navigation.
- Tests: `tests/unit/server-navigation.test.js`, `tests/server-browser/navigation.spec.js`,
  `responsive.spec.js`, `permissions-visual.spec.js`, `dashboard-scope.spec.js`, plus
  `npm run check:lines:ci` and `check:boundaries`.
- Acceptance: the four role examples in §2.4 render as specified; deep links and `?workspace=`
  unchanged; mobile drawer focus/close verified.

### 9.5 UI3 — Clients pilot

- Write: `src/features/records/RecordsPage.jsx`, `RecordTable.jsx`, `RecordTableEmpty.jsx`,
  `RecordDetails.jsx`, `RecordDetailFields.jsx`, `RecordEditor*.jsx`, `RecordReview.jsx`,
  `formSections.js`, `kept-chip.css`, the connected adapter call site in
  `src/features/server/ServerContent.jsx`, `src/styles/records/directory.css`,
  `src/styles/records/table.css`, `src/styles/system/records.css`, catalogue strings.
- Read-only: `useRecordAccess.js`, `useRecordEditor.js`, services, schemas, storage.
- Do not: change field lists/order, validation rules, permissions, versions, storage keys or
  export formats; do not restyle Contacts, Leads or workflow records beyond shared primitives.
- Tests: `tests/server-browser/persistence.spec.js`, `conflicts.spec.js`,
  `permissions-view-only.spec.js`, `permissions-visual.spec.js`, `assign-keyboard.spec.js`,
  `tests/unit/overflow.test.js`, plus `npm test`, `npm run build`, `check:i18n`, `check:lines:ci`.
- Acceptance: §7 in full, with before/after evidence at the four required viewports.

Later packets reuse these contracts; UI4–UI11 are assigned in
[plan §8](ui-redesign-plan.md#8-delivery-packets-and-gates) and must not broaden a UI1–UI3
allowlist.

## 10. Measurable regression checklist

| Role               | Must still work                                                                                               | Evidence                                                   |
| ------------------ | ------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| Company Admin      | Full CRUD in own workspace, finance and reports, team management, channel setup, agreements and marketplace   | 1280 + 390, both themes; existing specs green              |
| Restricted staff   | Assigned-only reads, grant-filtered nav, view-only directs, handoff/return                                    | nav snapshot + view-only chip; `assign-*`, `permissions-*` |
| Super Admin        | Workspace switching, cross-team read-only records, applications review, no company Inbox/chat/agreement terms | workspace banner, 403 states                               |
| Archived workspace | Read-only banner, hidden mutation controls, retained review access                                            | source state plus captured evidence when a fixture exists  |

Common: no route disappears without a recorded decision; no count, recipient, export or search
gains unauthorized data; drafts and versions survive; no provider, publishing or AI capability is
implied by the new interface.

## 11. Open items for pilot review

1. Omitting `Messages` from connected navigation for the Super Admin (§2.1).
2. The exact superseded copy for the unavailable panel and shell footer.
3. Whether `Workspaces` should remain visible to Admins once its screen is implemented, or move to
   Platform administration only.
4. The 60–64px top bar reduction against the 79px current bar, with the company name and account
   controls still usable at 390.

None of these is decided by UI0; they are review questions attached to UI1/UI2.

## 12. UI1 as built (2026-10-25)

Shared foundations only; no screen, shell, route, hook, service or data contract changed and no
consumer needed a call-site edit. Package version and dependencies unchanged.

### 12.1 What changed

| Primitive  | Built behaviour                                                                                                                                                                                                                                                                                      |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Button     | Props and the four variants preserved; caller attributes forward unchanged; icon stays `aria-hidden`; empty `title` is omitted; 44px minimum height; hover changes colour only (no position animation); active and disabled states distinct; focus ring shared with links                            |
| Badge      | `statusClass`, explicit-`tone` precedence and the em-dash fallback unchanged; the dot is decorative; text is 11px rather than 9px; all four tones have measured light and dark pairs                                                                                                                 |
| Pagination | Zero-based `page`, default 12-item size, `collection`/`table` variants and range maths unchanged; `aria-label` falls back to `<itemLabel> pagination`; the table pager keeps `n / m` visually and exposes `Page n of m`; disabled arrows are native-disabled and styled; wrapping pager at 320–390px |
| Empty      | Props and custom action preserved; default detail is neutral (`No records to show here.`) instead of promising record creation; title 15px and detail 13px on tokenised surfaces                                                                                                                     |

Files: `src/components/ui/{Button,Badge,Pagination,Empty}.jsx`,
`src/styles/ui/{buttons,badges,pagination-empty,accessibility}.css`,
`src/styles/system/controls.css`, and `tests/unit/ui-foundations.test.js`.

### 12.2 Measured contrast

Normal text target ≥4.5:1; values computed from the sRGB hex pairs actually used.

| Pair                                      | Ratio |
| ----------------------------------------- | ----- |
| Badge green light `#28603e` on `#e5f1e8`  | 6.38  |
| Badge amber light `#805b24` on `#f8efd9`  | 5.33  |
| Badge red light `#9b3d38` on `#fae8e5`    | 5.69  |
| Badge slate light `#51655b` on `#edf2ef`  | 5.52  |
| Badge green dark `#b2dfbd` on `#294735`   | 6.93  |
| Badge amber dark `#efd09d` on `#493d28`   | 7.16  |
| Badge red dark `#ffc3b9` on `#492d2a`     | 8.13  |
| Badge slate dark `#c5d4c9` on `#304339`   | 6.86  |
| Pager text light `--muted` on `--panel`   | 5.12  |
| Pager text dark `--muted` on `--panel`    | 7.62  |
| Empty detail light `--muted` on `--panel` | 5.12  |
| Empty detail dark `--muted` on `--panel`  | 7.62  |

The badge tones previously defined in `src/styles/system/records.css` and
`src/styles/theme/collections.css` are outside this packet's allowlist. The primitive now carries
the same measured values with higher specificity, so appearance is unchanged; removing the older
duplicates is a later cleanup.

### 12.3 Rendered evidence

All images are fresh captures under `docs/screenshots/ui-redesign/ui1/` (32 files).

| Run | Command                                                                                             | Role and state                                                                            | Viewports × themes                   | Files                                                                                   |
| --- | --------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------ | --------------------------------------------------------------------------------------- |
| A   | `PLAYWRIGHT_CHANNEL=chrome node scripts/test-crm-api.mjs --browser-only permissions-visual.spec.js` | Restricted staff on read-only Clients; Admin editing permissions; Super Admin team review | 390×844 and 1280×900, light and dark | `view-only-clients-*`, `team-ticks-enabled-*`, `team-ticks-disabled-*`, `team-review-*` |
| B   | `PLAYWRIGHT_CHANNEL=chrome node scripts/test-crm-api.mjs --browser-only dashboard-layout.spec.js`   | Admin and restricted staff, seeded dashboard and client desk                              | 390×900 and 1280×900, light and dark | `dashboard-{admin,staff}-*`, `client-desk-{admin,staff}-*`                              |

Both runs passed (2 tests, then 1 test) with no page overflow. They show badges, the table pager in
both variants, primary/light buttons and the read-only chip at both widths and themes.

**Evidence gap:** no existing connected spec captures a rendered `Empty` state, and adding a spec
is outside this allowlist. The Empty contract is covered by unit tests only; a later fixture
packet should capture an empty and a filtered-empty directory.

### 12.4 Checks

| Command                                         | Result                                         |
| ----------------------------------------------- | ---------------------------------------------- |
| `node --test tests/unit/ui-foundations.test.js` | 7 passed                                       |
| `npm test`                                      | 460 passed                                     |
| `npm run build`                                 | passed (existing chunk-size advisory only)     |
| `npm run check:i18n`                            | passed (33 namespaces, 1787 keys)              |
| `npm run check:lines:ci`                        | passed; 37 baselined oversized files unchanged |
| `npm run check:boundaries`                      | passed                                         |
| `npx prettier --check` on every changed file    | passed                                         |
| `git diff --check`                              | clean                                          |

`npm run check:lines` was not used to claim a repository pass; the baselined oversized inventory
is unchanged.

### 12.5 Limits

- Unit tests compile the `.jsx` primitives through Vite's existing SSR loader because the Node test
  runner cannot parse JSX; no test dependency was added.
- Empty default copy changed from a creation prompt to a neutral sentence. Consumers that pass
  their own `detail` are unaffected.
- No keyboard or screen-reader session was recorded for this packet; focus ring, ordering and
  disabled semantics were verified from source and rendered states, not by assistive technology.

## 13. UI2 as built (2026-10-25)

The connected shell now uses task-based navigation. Route names, paths, `canOpenSection`
predicates, workspace resolution, badges and full-height messaging are unchanged.

### 13.1 What changed

| Area                | Built behaviour                                                                                                                                                                                  |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Navigation model    | New `src/features/server/connectedNav.js`: nine display groups in fixed order, icons reused from the existing route map, `connectedGroups(user)` filters with the same access predicates         |
| One entry per route | `Workspaces` appears once (Company settings for an Admin, Platform administration for the Super Admin); `Team activity` appears once (Company settings for managers, Personal account for staff) |
| Work group          | Members see Inbox and Team chat; the Super Admin keeps the existing `Messages` preview in the same group. No new destinations                                                                    |
| Pinned groups       | Personal account, Company settings and Platform administration are separated from daily work by a hairline and spacing                                                                           |
| Shell copy          | Removed the repeated "YOUR BUSINESS, CONNECTED" eyebrow (one title per page) and the false footer sentence claiming messaging is not connected                                                   |
| Sidebar legend      | Removed the availability legend; the truthful "Not connected" chip stays on the two unavailable entries                                                                                          |

Files: `src/features/server/{connectedNav.js,ServerNavigationGroups.jsx,ServerNavigation.jsx,
ServerShell.jsx,navigation.css}`, `src/i18n/catalogs/en/navigation.js`,
`src/i18n/catalogs/index.js`, `ServerNavigationSettings.jsx` deleted,
`tests/unit/connected-navigation.test.js` (new), `tests/server-browser/navigation.spec.js`.

### 13.2 Verified role rendering

Rendered snapshot from the navigation spec (fixture owner, Super Admin):

- Overview: Dashboard. Relationships: Leads, Clients, Contacts, Client desk.
- Inventory & collaboration: Properties, Shortlist. Work & communication: Follow-ups, Viewings,
  Messages (Not connected), Interaction log, Client care.
- Finance & reporting: Deals, Payments, Expenses, Performance, Date search, CRM insights.
- Resources: Calculators, Guide. Personal account: My profile. Company settings: Team,
  Team activity. Platform administration: Workspaces (Not connected).

An Admin additionally sees Marketplace and Agreements, Channels, Inbox rules, and Workspaces in
Company settings, with Inbox and Team chat replacing Messages. Staff see My activity under
Personal account and no Company settings or Platform administration.

### 13.3 Checks

| Command                                                                                                                                   | Result                                         |
| ----------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| `node --test tests/unit/connected-navigation.test.js tests/unit/server-navigation.test.js`                                                | 6 passed                                       |
| `npm test`                                                                                                                                | 463 passed                                     |
| `npm run build`                                                                                                                           | passed (existing chunk-size advisory only)     |
| `npm run check:i18n`                                                                                                                      | passed (34 namespaces, 1796 keys)              |
| `npm run check:lines:ci`                                                                                                                  | passed; 37 baselined oversized files unchanged |
| `npm run check:boundaries`                                                                                                                | passed                                         |
| `PLAYWRIGHT_CHANNEL=chrome node scripts/test-crm-api.mjs --browser-only navigation.spec.js`                                               | 2 passed                                       |
| `... responsive.spec.js`                                                                                                                  | 2 passed                                       |
| Related connected specs (activity, agreements, record-sharing, workflow records, finance hand-over, permissions visual, dashboard layout) | see §13.4                                      |
| `npx prettier --check` on every changed file; `git diff --check`                                                                          | passed / clean                                 |

The navigation spec now allows 120s because it visits every destination and verifies every group
and entry, and it waits up to 20s for the restored session instead of 5s.

### 13.4 Limits and follow-ups

- The 79px top bar is shared with the frozen demo; the 60–64px target is not part of UI2.
- Marketplace, Agreements, Messages and Workspaces keep their existing availability; the two
  unavailable entries still show the truthful chip.
- The workspace banner for the Super Admin still repeats the workspace name (baseline B-08); it
  moves with the page-heading work in a later packet.
- Browser evidence for this packet is captured in `docs/screenshots/ui-redesign/ui2/`
  (`navigation-desktop-{light,dark}.png` at 1440×900 and `navigation-mobile-{light,dark}.png`
  at 390×844, Super Admin owner fixture, reduced motion, fresh from
  `navigation.spec.js` on 2026-10-25). The separate `navigation-desktop-*.png` files directly
  under `ui-redesign/` remain the UI0 baseline captures recorded in
  [the baseline](ui-redesign-baseline.md#3-evidence-index); they are not UI2 output.
