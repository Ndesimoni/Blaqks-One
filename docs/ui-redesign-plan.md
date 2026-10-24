# Connected CRM — whole-product UI organization and redesign plan

Prepared 24 October 2026 for the owner's request: organize the entire CRM into a professional, consistent interface and prepare the work for DeepSeek.

**Status: proposed implementation plan, not a completed redesign.** This request authorizes preparation of the plan and handoff. Start DeepSeek with [UI0 instructions](deepseek-prompts/UI0-ui-redesign.md); do not execute the entire program in one session. Review the proposed navigation and visual pilot before rolling their patterns across the product.

## 1. Outcome and scope

The objective is not a new skin on inconsistent screens. The CRM needs a coherent navigation model, predictable page structures, compact working areas, consistent actions and forms, accessible states and reliable mobile behavior. A broker should understand where to work, what needs attention and what will happen after an action.

Cover **every existing connected screen and overlay**, including sign-in and setup, ordinary records, finance, messaging, agreements, marketplace, administration, imports and error/deep-link states. Keep all working functionality. Preserve the forest-green, neutral and restrained gold identity, both themes, system font and existing product terminology.

This is frontend organization and presentation work. It does **not** authorize backend/API redesign, migrations, new business features, provider connections, external messages, purchases, hosting, domain registration or public publication. Public websites/mobile, domain purchasing, BO1, external-agent onboarding, future marketplace answers/deal flows and deferred Calendar connections remain separate roadmap work. Do not create attractive but nonfunctional controls for them.

### Definition of a professional result

- One clear title, understandable scope and dominant task per page; secondary actions remain discoverable.
- The same task uses the same component, wording, spacing and interaction across modules.
- Records, conversations and decisions take precedence over welcome text, status banners and decorative panels.
- All existing workflows remain reachable under the correct permissions, including less frequent and read-only workflows.
- Desktop is efficient for daily work; mobile is deliberately composed, not a squeezed desktop table.
- Loading, empty, filtered-empty, errors, permission denial, conflicts and unavailable capabilities have truthful, actionable states.
- Completion requires rendered evidence and behavior tests, not only a successful build or an aesthetic opinion.

## 2. Evidence and starting problems

This plan combines a source review, architecture review, product-design review and inspection of saved images. It is **not** a fresh browser audit of the whole application. UI0 must record current evidence with fictional data before implementation.

| Observation                                                                   | Evidence                                                                                                                                               | Design response                                                                               |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------- |
| Daily work, collaboration and reporting are mixed into a long navigation tree | `ServerNavigationGroups.jsx` consumes demo-oriented groups and inserts Agreements/Marketplace; `ServerNavigationSettings.jsx` mixes eight destinations | Connected-only, task-based navigation; separate personal, company and platform administration |
| Shell and features can repeat introductions and headings                      | `ServerShell.jsx`, `RecordsPage.jsx`, `PropertyDirectory.jsx`, `dashboard/ServerDashboard.jsx`                                                         | One owner for the page title; count and concise context become metadata, not repeated panels  |
| Properties place several control/summary bands before inventory               | `PropertyDirectory.jsx` composes summary, purpose controls, results/search and advanced filters                                                        | Compact toolbar, visible active filters and progressive disclosure                            |
| Generic product-status copy is inaccurate                                     | `ServerShell.jsx` footer says messaging is not connected despite implemented connected messaging                                                       | Remove repeated operational footer; show accurate feature-specific setup/delivery states      |
| Agreement details and actions need a stronger decision hierarchy              | `agreements/AgreementBody.jsx` and `AgreementActions.jsx`                                                                                              | Current state/response first; separate terms, payments and evidence; group secondary actions  |
| Marketplace membership context takes priority over browsing                   | Saved MK2 board screenshots at 390px light and 1280px dark; `MarketplaceApproved.jsx`                                                                  | Compact eligible-member status; Board/My requests become the working surface                  |
| Profile sections are presented consecutively without strong scope separation  | `profile/ServerProfile.jsx`                                                                                                                            | Personal section navigation; company settings clearly separated                               |
| Shared and feature CSS overlap                                                | Ordered `styles/index.css`, `system.css` imports and component-local CSS                                                                               | Map cascade before changes; migrate one shared contract at a time                             |

Saved MK2 mobile evidence shows the first request beginning around y=704 in a 390×900 image, after approval status and five filters. This is a saved-state observation, not a universal measurement. Historical `docs/screenshots/design-*` images establish the approved identity but do not establish today's connected behavior.

The architecture review ran `npm run check:lines`: **37 of 2,337 checked files exceed 150 lines** at this checkpoint. Relevant legacy files include `team.css`, `property-collection.css`, `auth.css`, `responsive.css`, `overflow.css` and `property-responsive.css`. Recheck at execution time; split a touched oversized file by responsibility, never compress it or increase the baseline.

<details>
<summary>Existing line-limit backlog, rechecked during plan preparation</summary>

`npm run check:lines` exits 1 for the following existing files. This documentation-only packet changes none of them. Several belong to the frozen demo or deferred Calendar edition; their presence is not permission to expand this redesign into those editions.

| File                                         | Physical lines |
| -------------------------------------------- | -------------: |
| `src/styles/team.css`                        |            777 |
| `src/data/demo.js`                           |            620 |
| `tests/browser/messaging.spec.js`            |            567 |
| `src/features/team/model.js`                 |            548 |
| `tests/browser/team.spec.js`                 |            436 |
| `src/styles/property-collection.css`         |            428 |
| `src/styles/messaging.css`                   |            416 |
| `tests/browser/overflow.spec.js`             |            408 |
| `src/styles/auth.css`                        |            399 |
| `tests/unit/team.test.js`                    |            363 |
| `src/features/team/TeamPage.jsx`             |            351 |
| `src/styles/calendar.css`                    |            347 |
| `tests/browser/workspaces.spec.js`           |            338 |
| `tests/browser/leads.spec.js`                |            329 |
| `src/styles/responsive.css`                  |            313 |
| `tests/unit/frontend.test.js`                |            305 |
| `src/features/calendar/CalendarPage.jsx`     |            289 |
| `src/features/team/TeamFields.jsx`           |            285 |
| `src/features/team/AccountPreviewPages.jsx`  |            272 |
| `src/lib/excel.js`                           |            270 |
| `src/hooks/useRecordActions.js`              |            269 |
| `tests/browser/crm.spec.js`                  |            267 |
| `src/features/auth/SignInPage.jsx`           |            249 |
| `tests/unit/messaging.test.js`               |            242 |
| `src/styles/overflow.css`                    |            233 |
| `src/features/activity/TeamActivityPage.jsx` |            225 |
| `src/features/messaging/MessageAudience.jsx` |            204 |
| `src/features/team/ProfilePage.jsx`          |            204 |
| `src/styles/workspaces.css`                  |            182 |
| `tests/deferred/calendar.spec.js`            |            177 |
| `src/features/calendar/selectors.js`         |            168 |
| `tests/unit/workspaces.test.js`              |            167 |
| `src/features/team/TeamWizard.jsx`           |            164 |
| `tests/unit/workspace.test.js`               |            161 |
| `src/features/team/MemberManager.jsx`        |            160 |
| `src/lib/crm.js`                             |            156 |
| `src/styles/property-responsive.css`         |            153 |

</details>

### Priority order

1. **Safety and honesty:** preserve permissions, scopes, unsaved drafts and genuine capability states; fix obstructed essential actions.
2. **Organization:** navigation, single headings, page templates, action hierarchy and records above excessive chrome.
3. **Consistency:** reusable controls, filters, forms, details, state presentation and typography.
4. **Product-wide adoption:** each screen family, including account/admin and exceptional states.
5. **Polish:** subtle motion, chart clarity, alignment and final screenshot references after the structure works.

## 3. Proposed information architecture

These are **display groups**, not new role definitions, APIs or route identifiers. Keep existing hash URLs, deep links, browser history, `workspace`/`q` handling and access predicates. Use a connected-only configuration rather than reorganizing the frozen demo's shared `config/navigation.js`.

| Navigation group          | Existing destinations                                                                                  | Purpose                                                                               |
| ------------------------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------- |
| Overview                  | Dashboard                                                                                              | Priorities and business overview                                                      |
| Relationships             | Leads, Clients, Contacts, Client desk                                                                  | People, requirements and matching                                                     |
| Inventory & collaboration | Properties, Shortlist, Marketplace, Agreements                                                         | Listings and broker collaboration                                                     |
| Work & communication      | Follow-ups, Viewings, Inbox, Team chat, Interaction log, Client care                                   | Daily commitments and conversations                                                   |
| Finance & reporting       | Deals, Payments, Expenses, Performance, Date search, CRM insights                                      | Financial work and analysis                                                           |
| Resources                 | Calculators, Guide                                                                                     | Supporting tools and instructions                                                     |
| Company settings          | Team & access, Team activity for managers, Channels, Inbox rules; existing Workspaces entry for Admins | Existing company administration; preserve current route availability/status           |
| Personal account          | My profile, My mailbox, My activity for staff, theme, sign out                                         | Personal identity/preferences; My activity retains the Team activity route identifier |
| Platform administration   | Workspaces for Super Admin, Marketplace applications and other already-authorized platform controls    | Super Admin's existing duties only; Admin Workspaces availability is not removed      |

Desktop uses a 240–256px sidebar as a starting target, with clear groups and one nesting level at most. Permit group disclosure if needed; the active route's group stays open and visible. Personal account and Settings entry points stay reachable independently of the long daily-work list. Do not introduce a separate Settings application or new settings APIs; group existing destinations with section navigation.

Mobile uses the existing accessible navigation dialog with the same destinations and ordering. Avoid adding a second competing bottom navigation. Close the menu after navigation and restore sensible focus. Current company identity remains visible; workspace switching is restricted to its existing authority and cannot silently switch scope.

Filter every destination with existing `canOpenSection` rules and omit empty groups. Preserve exact unread/waiting badge meanings and authorized count endpoints. Never fetch hidden records or conversations merely to decorate a sidebar. Marketplace application review and company marketplace participation remain different privileges. Super Admin navigation must not imply access to company Inbox, private chat or agreement terms.

**Verified during UI0:** `Workspaces` is authorized for both an Admin and the Super Admin by `canManageTeam` (`src/features/server/access.js`), so the target navigation must render it once per viewer — Company settings for an Admin, Platform administration for the Super Admin — not twice. Company members already see Inbox/Team chat in the shared `Messages` slot; the Super Admin keeps the frozen demo preview there. Whether that preview entry stays in connected navigation is a pilot-review question in the [pattern specification](ui-pattern-spec.md#11-open-items-for-pilot-review).

Navigation grouping must not change authority: staff retain their own activity, Admins retain the currently allowed Workspaces destination/status, and only Super Admin retains cross-company workspace switching. The current connected header has no global search; preserve existing module searches and query links, but do not add a global search feature as part of the shell redesign.

## 4. Shared layout and visual system

### 4.1 Layout families

Create a small set of compositions, not one inflexible wrapper for everything:

| Family        | Composition                                                                    | Used by                                                               |
| ------------- | ------------------------------------------------------------------------------ | --------------------------------------------------------------------- |
| Directory     | Title/action → compact toolbar → active filters → records → pagination         | Clients, Contacts, Leads, Properties, workflow records, finance lists |
| Overview      | Title/scope → actionable priorities → selected metrics → supporting analysis   | Dashboard, Performance, CRM insights                                  |
| Workspace     | Pane navigation → conversation/work content → optional context                 | Inbox and Team chat; full-height with independent pane scrolling      |
| Review/detail | Identity/state → required response → facts/terms → related information/history | Record dialogs, agreements, shares, finance reviews                   |
| Settings      | Scope/title → section navigation → constrained form/content → save feedback    | Profile, Team, channel/mailbox setup and administration               |
| Utility       | Purpose → inputs/filters → computed results/instructions                       | Calculators, Date search and Guide                                    |
| Identity      | Focused form → validation/progress → recovery/next step                        | Connected sign-in, registration, verification and activation          |

Ordinary pages own one `h1`. Inbox/chat retain accessible internal headings without the shell adding a second heading or footer. Persistent safety notices for archived workspaces remain conspicuous; routine connection status does not need a large banner on every screen.

### 4.2 Starting design values

These extend the approved [design standards](design-standards.md); verify them in the pilot rather than scattering literal values across features.

| Token/contract | Target                                                                                                                   |
| -------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Palette        | Existing semantic green/neutral/gold tokens; dark gold primary, light green primary; no Limestone/Midnight revival       |
| Typography     | System stack; page title 28–32px desktop/24–28px phone; section 18–20px; body 14–16px; supporting labels 12–13px         |
| Spacing        | 4, 8, 12, 16, 24, 32px; one enclosing surface per task; internal alignment/rules instead of repeated nested cards        |
| Main gutters   | 24–32px desktop, 20–24px tablet, 16px phone                                                                              |
| Top bar        | Approximately 60–64px, if identity, search and controls remain usable (current bar is 79px)                              |
| Controls       | Approximately 40px desktop; 44px primary touch controls; adequate separation for compact actions                         |
| Forms          | Constrained readable width, usually two columns only for naturally paired fields; single column on phones                |
| Dialogs        | Existing centered shared Drawer, currently 840×800px standard/1040×900px wide; existing full-screen phone treatment      |
| Depth          | Hairline borders, low shadows, no decorative gradients or large ornamental banners                                       |
| Numbers        | Existing UAE formatting; tabular numerals for amounts/counts; monetary columns right-aligned                             |
| Motion         | Existing approximately 160ms semantic transition; no essential information conveyed by animation; reduced-motion support |

The sidebar is already 255px with a matching `main-area` offset, so the 240–256px target requires no width change. `.detail-drawer { width: 545px }` is currently overridden by `.modal-centered > .drawer`; packets must not depend on that class for sizing (see [pattern specification §1](ui-pattern-spec.md#1-verified-current-measurements)).

### 4.3 Component contracts

Reuse `Button`, `Drawer`, `Empty`, `Metric`, `Pagination`, `OverflowList`, `FormStepper`, `FieldHint`, `Badge`, `LabelValue` and `TitleSection`. Extend only where an actual repeated need is missing. Suggested contracts below are responsibilities, not instructions to create duplicate primitives or those exact filenames.

| Pattern              | Required behavior                                                                                                               |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Page heading         | Title, optional one-line context/scope, count and one dominant action; wrapping action cluster on phones                        |
| Directory toolbar    | Search, essential filter, assignee where relevant, Filters with active count, view toggle, labelled secondary data/actions menu |
| Active filters       | Removable chips and Clear filters; closed advanced panel retains values; filter changes reset page                              |
| Record presentation  | Consistent identity, status, key facts and actions; table headers/cells aligned; card order matches task importance             |
| Selection bar        | Appears after selection; count and only existing authorized bulk actions; no silent cross-page selection change                 |
| Status badge         | Visible text plus color/icon where helpful; business states remain distinct, not one generic success/warning                    |
| Async state          | Stable loading area, useful empty/filtered-empty distinction, contextual error/retry, retained drafts and pending feedback      |
| Form field           | Persistent label, required indicator, existing guidance, associated error and correct input/autocomplete                        |
| Review/action footer | Save or current response as primary; Cancel/Back secondary; dangerous lifecycle actions separated and confirmed                 |
| History/evidence     | Actor/time/state readable; immutable snapshot/version clearly identified; no private data substituted into evidence             |
| Data menu            | Existing export/import/backup actions remain discoverable and scoped; do not add unsupported import formats                     |

Do not hide frequent actions behind ambiguous three-dot icons. Label secondary menus (for example, Actions or Data); label icon-only controls accessibly. Do not add card-wide click handlers that conflict with links, selection or row actions.

### 4.4 Representative directory wireframe

```text
Desktop
┌ Sidebar ┐  Company / workspace context                 Theme · Account
│ Groups  │  Clients  ·  authorized count                   [Add client]
│ Active  │  [Search clients…] [Status] [Assigned to] [Filters (2)] [Data]
│ route   │  Active filters: [Dubai ×] [Buying ×]       Clear filters
│         │  □ Name / contact      Requirement      Stage     Assignee  Actions
│         │  □ Record…             …                …         …        …
│         │  Showing 1–… of …                              [Previous] [Next]
└─────────┘

Phone
[Menu] Company                                     [Account]
Clients · count                                [Add client]
[Search clients…]                  [Filters (2)] [Data]
[Compact active filter summary / clear]
[Record identity · stage]
[Requirement · assignee · labelled actions]
[Next record / meaningful empty state]
[Pagination]
```

No search/filter capabilities may be invented to match the drawing. Reuse existing ones; document a genuinely missing capability as a separate product backlog item. Exact columns and primary action visibility follow module permissions.

## 5. Screen-by-screen redesign brief

UI0 expands this into an exhaustive route/dialog manifest. The following families are all in scope; a finished pilot is not a finished whole-app redesign.

| Screens / workflows                                                                                                    | Main task and target organization                                                                                                                                 | Preserve / acceptance focus                                                                                                                                 |
| ---------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Connected sign-in, sign-up, verification, company setup, invitation activation, expired links, sign-out/session errors | Focused form, short progress, clear field errors and one next action; show recovery only where implemented                                                        | Password manager/paste/autofill; actual account authority; no demo identity fallback or pretend recovery                                                    |
| Shell, mobile menu, existing module searches, workspace switch and archived banner                                     | Consistent task navigation, company identity and single heading; clear scoped searches where already implemented                                                  | Existing route/query/back behavior; authorized results; unsaved-change guard; archive read-only state; no new global search                                 |
| Dashboard                                                                                                              | Priorities and upcoming commitments first; at most four initial headline figures; supporting counts/charts lower                                                  | Existing metric definitions, source/time scope and permissions; no fabricated trends; setup checklist remains recoverable                                   |
| Leads                                                                                                                  | Source/stage/assignment and next task readable in one directory; concise source filter rather than tile wall                                                      | Leads remain a Clients view; original qualification, scoring, source fields and shared-copy restrictions                                                    |
| Clients                                                                                                                | Identity/contact, requirement, relationship stage and owner easy to scan; Add client when allowed                                                                 | Search/filter/selection/export, assignment, linked records, existing detail/editor/message shortcuts                                                        |
| Contacts                                                                                                               | Role/type and best contact method prominent; location details secondary                                                                                           | Existing recipient eligibility and messaging grants; no leaking inaccessible contacts                                                                       |
| Client desk / matching                                                                                                 | Select client → inspect requirements → see matching inventory → next permitted action                                                                             | Existing match rules and scope; selection/search retained; task-client and property links remain correct                                                    |
| Properties: sale/rent/holiday/commercial/off-plan/secondary                                                            | One compact directory; grid/table share dataset/page; image → price → identity/location → key facts → status/actions                                              | Twelve per page; current categories/fields; stored preference; real media/floor plans, labelled demo fallbacks and media error handling                     |
| Property editor/gallery/details                                                                                        | Group identity, pricing, features, media and ownership; preserve long-form section/review structure                                                               | Upload progress/failure, amenity More behavior, photo ordering and floor plans; no model mutations from presentation                                        |
| Follow-ups and Viewings                                                                                                | Due/upcoming/completed/overdue context and next task; client/property/assignee links obvious                                                                      | Existing schedule metadata and mutations; no deferred Calendar controls; clearly formatted date/time                                                        |
| Shortlist, Interaction log, Client care                                                                                | Reuse directory/task pattern, concise context and relevant linked entities                                                                                        | Full collections, current fields, recording/closing actions, counts and export semantics                                                                    |
| Deals                                                                                                                  | Listing/counterparties/stage/commission/state first; current task or approval prominent                                                                           | Existing estimates versus earned amounts, split rules, approvals, revision/history and hand-over rules                                                      |
| Payments and Expenses                                                                                                  | Aligned amount/date/status tables, concise filters and scoped summaries; decision/reason in detail                                                                | Pending/approved/rejected/voided distinct; separation of duties, server allowed actions, receipts and financial totals unchanged                            |
| Commission statements and finance settings                                                                             | Separate calculated explanation, recorded money and configurable policy                                                                                           | Existing formulas/currencies/rounding and authority; no redefinition as generic Revenue                                                                     |
| Performance, CRM insights, Date search                                                                                 | Shared scope/date controls, readable outcomes, textual chart summaries and linked records                                                                         | Own/team/workspace distinction; no unauthorized aggregate totals; empty and invalid-range states                                                            |
| Inbox, conversation details, saved replies and drafts                                                                  | Desktop list/thread/optional context; mobile list → thread → context; maintain composer priority                                                                  | Full-height panes, existing growing composer/attachments, send versus note modes, recipients, drafts, queued/sent/failed states and authorized delivery     |
| My mailbox, Channels and Inbox rules                                                                                   | Personal mailbox and company provider setup clearly separated; status, next setup step and actions aligned                                                        | Real provider capability and permission; existing SendGrid setup and rules; no claim that deferred channels work                                            |
| Team chat: channels, direct messages, private groups, mentions                                                         | Familiar list/thread layout, clear room type and membership; context tucked away                                                                                  | Private messages/groups remain private; Admin cannot inspect them; mention behavior and unread semantics unchanged                                          |
| Agreements lists/detail/amendment/completion/cancellation/archive                                                      | List shows type, counterparty, property, status and waiting-on; detail orders Overview, Terms/revision, Payments, Evidence/history                                | Current accepted versus proposed revision; mandatory review before acceptance; frozen evidence, permitted transitions, confirmations and certificate access |
| Incoming/internal shares and outside listing share links/co-broking                                                    | State and recipient action first; explicit view-only/introduction/accepted labels; clear provenance                                                               | Share scope/expiry/revocation, hidden fields, messaging restrictions and original snapshots; outside sharing is properties only                             |
| Certificates and printable evidence                                                                                    | Clean document typography, print layout and reachable controls; prevent action strips covering content                                                            | Content/evidence accuracy and signatures unchanged; verify known mobile spacing and light checkbox concerns before declaring fixed                          |
| Marketplace application/join/profile/Board/My requests                                                                 | Eligibility gate first when needed; joined members see compact status and working board; cards prioritize purpose, budget, areas, requirements, expiry and broker | MK1/MK2 only; own company marked Your company; existing consent, company switch, renew/close rules; no MK3 answer/MK4 deal controls                         |
| Marketplace applications (platform review)                                                                             | Separate administrative queue with application state, reviewed details and existing decisions                                                                     | Platform review authority only; no implied company marketplace membership                                                                                   |
| Team, roles/grants/invitations and archive review                                                                      | Compact member directory; permissions grouped by module, action and separate messaging grants; contextual invitation status                                       | Admin's own team only; only Super Admin invites Admins/archives; seat rules, required phone, no Super Admin promotion; archive never restored by edit       |
| My profile, password and sessions                                                                                      | Personal section navigation: details, guidance, security, active sessions; separate company information visually                                                  | Existing edit authority and read-only fields, session revocation and unsaved drafts; no new recovery/MFA implementation                                     |
| Workspaces, Team activity and import review                                                                            | Clear directory/scope, searchable attributable history, step-by-step source/destination review                                                                    | Super Admin boundaries, redacted activity, retained archives; atomic add-only imports, complete backups, no unsupported finance migration                   |
| Calculators and Guide                                                                                                  | Calm constrained forms, results next to explanations, consistent navigation/units                                                                                 | Existing calculations/disclaimers; no hard-coded market assumptions or nonexistent product guidance                                                         |
| Not connected, forbidden, not found, loading, retry and revoked access                                                 | Explain this state precisely and offer an authorized next step                                                                                                    | No silent demo fallback, data clearing, speculative success or new capability disguised as a redesign                                                       |

## 6. Interaction, responsive and accessibility acceptance

### Behavior and state rules

- Preserve filters and selections through presentation changes; filter changes reset pagination and mutations clamp invalid last pages. Do not silently change existing page size outside the approved module contract.
- Distinguish no records, no matching results, inaccessible content and network failure. Empty states offer the actual permitted action, never an action the role cannot perform.
- Keep save feedback attached to the action. Disable duplicate submits while pending; show success only after the existing server commit. Conflict/errors retain drafts and explain retry/reload choices.
- Use existing native `Drawer` dialogs, focus trap/restoration, Escape, backdrop policy and unsaved guard. Do not add a parallel modal engine or stack conflicting editors.
- Keep short forms short; retain section/step navigation for long forms. Validate before progressing; associate inline errors and focus a useful error target. Mobile keyboard must not cover focused fields or Save/Cancel.
- Put the current business response above secondary actions. Separate destructive/terminal actions with the existing reason/review/confirmation requirements; never auto-focus an irreversible confirmation.
- Preserve natural page scrolling for ordinary directories; bounded scrolling for searchable pickers; internal scrolling for messaging panes/dialog bodies. Six-item More **replaces** the compact list with the complete collection and one close control.

### Viewports and measurable targets

- Required visual evidence: **390px and 1280px in both themes**. Check 320px reflow, 768px tablet and 1440px wide layouts; record exact viewport heights.
- Pilot density target at 390×844: first ordinary record or meaningful empty/loading state starts within approximately **520px** from the viewport top. Safety/archive notices and genuinely essential setup gates are justified exceptions, not content to hide. Validate the target with readable controls rather than shrinking text.
- At 1280×800, ordinary directories expose useful records in the first viewport without scrolling past repeated introductions. Keep search/filter/actions visible and aligned.
- No horizontal **page** overflow. A necessary wide table may scroll within a labelled, keyboard-usable container; mobile cards may replace it if all essential data/actions remain reachable.
- Test long names, prices, IDs, validation messages, large and empty lists, attachment failures, 200% zoom, reduced motion and mobile virtual keyboard behavior.

Accessibility target is [WCAG 2.2 AA](https://www.w3.org/TR/WCAG22/), not a certification claim. Measure actual rendered normal-text contrast at least 4.5:1, large text 3:1 and applicable non-text UI contrast 3:1 in both themes. This project's preferred 44px primary touch targets exceed the AA minimum in ordinary cases; do not claim every compact desktop control must be 44px under WCAG.

Use semantic landmarks, headings, labels, table headers and native controls. Every action is keyboard reachable with visible, unobscured focus; icon controls have accessible names. Verify focus restoration after menus/dialogs and screen-reader naming/status feedback. Status is not color-only. Do not implement ARIA tabs without their required keyboard behavior; ordinary navigation links are often sufficient. Automated checks supplement manual keyboard and representative screen-reader testing.

## 7. Non-negotiable architecture and data contracts

The connected chain is `ServerApp` → session/directory resolution → actor/owner-keyed `ServerWorkspace` → `ServerShell` → `ServerContent`. Organize presentation around this chain; do not rebuild authentication or merge providers to simplify rendering.

- Resolve authorized workspace **before** reading records. Preserve actor versus workspace owner, role predicates, assignment projections and keyed remounts. No cross-company aggregation, unauthorized counts or merged recipient directories.
- Keep `canOpenSection`, `canAct` (including Leads → Clients mapping), API authorization and server `allowed` actions authoritative. Hiding a button is not an access control fix.
- Preserve kept-versus-owned records in counts, lists, exports and recipients. Shared copies cannot acquire edit/message actions through a new common toolbar.
- Preserve optimistic UUID/version metadata, server error handling, cancellation, count refresh events and draft retention. UI refactors must not introduce duplicated requests or stale workspace responses.
- Preserve workbook fields/order, storage keys, JSON backups, imports, media references, finance formulas and existing service clients. No automatic browser migration and no server-to-demo fallback.
- Preserve immutable agreement/share revisions and payment evidence. Never substitute a current private CRM record into a frozen shared snapshot for a prettier detail view.
- Keep all new interface text in English catalogues through `useI18n()`. Frozen Arabic and its disabled preview remain untouched. Demo is frozen; shared components must stay compatible without demo-specific redesign/tests.
- No new UI framework, state framework, router, icon package, font service or chart dependency without a documented need and separate scope decision. Prefer existing primitives and small native/SVG presentation.

### CSS and component migration strategy

1. UI0 maps the ordered global imports and dynamic feature imports, actual selector owners and affected shared/demo consumers.
2. Define semantic layout/control/state tokens in the existing system. Preserve existing color tokens rather than copying palette literals.
3. Assign **one owner** to shared CSS, catalogue registration and connected navigation. Feature implementers receive disjoint write sets and use the established contracts.
4. Refactor touched oversized files into named responsibility files before adding changes; preserve relative cascade order, media rules and selector behavior. No numbered fragments or blanket `!important` fixes.
5. Migrate one pilot and then a family at a time. Remove obsolete selectors only after verifying consumers; avoid leaving both old/new page chrome around the same feature.
6. Keep components at module scope and non-React logic separate. Use focused workspace hooks; no single all-purpose page/controller with dozens of boolean props.

## 8. Delivery packets and gates

Relative sizes are for sequencing, **not calendar estimates**. Re-estimate after UI0. Each row is one bounded session; split a row further if its concrete manifest exceeds a safe packet. Do not combine the program into a giant rewrite.

| Packet                                                           | Deliverable / initial write boundary                                                                                     | Acceptance and dependency                                                                                                                                        |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| UI0 — audit and blueprint (S)                                    | Documentation and synthetic screenshot evidence only; route/role/state manifest, CSS/component map and target wireframes | Current baseline recorded; every route assigned a template; no app changes. Review navigation and target pilot before UI1                                        |
| UI1 — foundation (M)                                             | Small selected `components/ui/` and `styles/system/` contracts, associated English strings/tests                         | Controls, title/toolbar/state patterns work in both themes without regressions; no broad page restyling                                                          |
| UI2 — connected shell (M)                                        | `ServerShell`, `ServerHeader`, connected navigation files/new connected-only nav definition and exact styles/tests       | Grouping, role filtering, deep links, mobile menu/focus and workspace context verified; full-height modes preserved                                              |
| UI3 — Clients pilot (M)                                          | `features/records/` presentation plus explicitly listed connected adapters; client details/editor                        | Admin/restricted staff/read-only behavior; filtering, CRUD/conflict, assignment, forms and mobile evidence. **Visual/behavior acceptance before broad adoption** |
| UI4a — Leads and Contacts (S/M)                                  | Relevant relationship feature files and configurations                                                                   | Same shared vocabulary; lead/client relationship and recipient/access restrictions preserved; depends UI3                                                        |
| UI4b — Properties and matching (M)                               | `features/properties/`, connected `clientDesk/`, exact media/presentation styles                                         | Grid/table parity, twelve-per-page, filtering/media/details/matching at all viewports. Second stress-test of UI3 patterns                                        |
| UI5 — workflow records (M)                                       | Explicit record configurations/presentation for Follow-ups, Viewings, Shortlist, Interaction log and Client care         | Due/state/linked records, assignment and complete collections verified; no Calendar revival                                                                      |
| UI6 — finance (M; sensitive review)                              | `server/finance/` presentation and focused tests only                                                                    | All amounts/calculations/lifecycle/approval contracts unchanged; security review if action rendering or scoped reads change                                      |
| UI7 — overview and tools (M)                                     | Connected dashboard/performance/insights/dateSearch/calculators/guide folders, split as needed                           | Metric definitions and scope clear; actual counts/calculations unchanged; responsive visual summaries                                                            |
| UI8a — Inbox and setup (M; split by subfeature)                  | `inbox/`, `composer/`, saved replies, mailbox, Channels and rules presentation                                           | Existing full-height messaging/composer tests; drafts, attachments, send states and setup authority preserved                                                    |
| UI8b — Team chat (M)                                             | `server/chat/` presentation                                                                                              | Channels/DM/groups/mentions usable on mobile; privacy and unread semantics preserved                                                                             |
| UI9a — agreements and sharing (M; sensitive review)              | `agreements/`, `shares/`, `listingShares/` presentation; split list/detail/evidence if needed                            | Revision review, acceptance/payment/certificate/share flows preserved; snapshot and role checks receive independent review                                       |
| UI9b — marketplace (M)                                           | `server/marketplace/` presentation and exact catalogue files                                                             | MK1/MK2 gates/consent/Board/My requests/platform review preserved; no future answers/deals added                                                                 |
| UI10a — identity and account (M; sensitive review)               | Explicit connected sign-in/signup/activation/profile presentation files                                                  | No session/auth contract changes; forms, verification, expired states, password/sessions keyboard behavior verified                                              |
| UI10b — company/platform administration (M; split by subfeature) | `server-team/`, directory/activity/import presentation files named in manifest                                           | Team authority, archived views, workspace context and atomic source/destination import review unchanged                                                          |
| UI11 — release acceptance (M)                                    | Explicit residual fixes, evidence, standards and approved screenshot references                                          | Exhaustive manifest closed, cross-product/accessibility review, full CI green and remaining limitations reported                                                 |

UI0 and UI3 are deliberate design checkpoints for a whole-product reorganization. Other already-authorized packet reviews do not create unnecessary approval loops. DeepSeek implements only the packet it is given; Codex/Claude or the coordinating reviewer reviews its diff and evidence. Commit/push only when the owner authorizes it.

## 9. Verification plan

UI0 is documentation/evidence only: check documentation formatting, links, source accuracy and `git diff --check`. Any baseline command failure is recorded, not hidden or repaired outside scope.

For application packets, use the [token-efficient delivery protocol](token-efficient-delivery.md): focused checks during development, then `npm test`, `npm run build`, applicable `check:i18n`, `check:boundaries`, `check:lines:ci`, full `check:lines` inventory and changed-file formatting. Existing oversized files remain reported backlog, not a claimed pass. A changed file must meet the 150-line limit regardless of the legacy baseline.

| Area                           | Existing focused evidence to reuse/extend                                                                                                                                              |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Shell/navigation/roles         | `tests/unit/server-navigation.test.js`; connected `navigation.spec.js`, `responsive.spec.js`, `permissions-view-only.spec.js`, `permissions-visual.spec.js`, `dashboard-scope.spec.js` |
| Records/pilot/properties       | Connected `persistence.spec.js`, `conflicts.spec.js`, `properties.spec.js`, `property-links-layout.spec.js`, `contacts-location-layout.spec.js`, `assign-keyboard.spec.js`             |
| Overview                       | Connected dashboard layout/count/scope specifications; existing calculator/insights tests selected from manifest                                                                       |
| Finance                        | Existing finance and hand-over specifications selected per actual affected workflows; verify totals and approval roles, not just styling                                               |
| Messaging                      | Connected `inbox-layout.spec.js`, `messenger-size.spec.js`, `saved-replies.spec.js`, `team-chat.spec.js`, `team-chat-groups.spec.js`; attachment/rule/access specs as relevant         |
| Agreements/sharing/marketplace | Connected `agreements-lifecycle.spec.js`, `record-sharing.spec.js`, `outside-co-broking.spec.js`, `marketplace-apply.spec.js`, `marketplace-requests.spec.js`                          |
| Identity/admin/imports         | Connected `profile.spec.js`, `signup.spec.js`, `team-responsive.spec.js`, `import-backup.spec.js`, `import-workspaces.spec.js`; role/archive tests as relevant                         |

Use the existing connected harness, for example:

```sh
PLAYWRIGHT_CHANNEL=chrome node scripts/test-crm-api.mjs --browser-only navigation.spec.js responsive.spec.js
```

Run fixed-port browser harnesses **sequentially**, with fictional fixtures and the disposable Docker database. The harness uses connected Vite on 5175; do not restart/migrate development services or use real client data for screenshots. Do not run frozen-demo `npm run test:e2e` routinely. If Docker/browser prerequisites are unavailable, record the blocker and unverified states; do not claim a browser pass.

Full API/connected-browser suites run in CI under the existing protocol; sensitive changes require the broader pre-merge checks and independent security review. UI-only work should not need Rust changes; if it does, stop and define the separate backend scope rather than silently expanding the redesign.

### Required packet handoff

Report: packet ID/status; changed files; preserved workflows and role scenarios; checks with exact results; before/after images with viewport/theme/role/state; unresolved findings and exact next packet. No unverified “production-ready,” “fully accessible” or “entire UI complete” claims.

## 10. Completion, rollout and rollback

The redesign is complete only when the UI0 route/dialog manifest is reconciled against the current router and all existing screen families, common/exceptional states and roles have evidence. Update it as concurrent product work adds screens. No page may disappear merely because it was absent from an initial screenshot sample.

Release gates:

1. Owner accepts the pilot's organization, density and visual language; approved reference previews and standards are updated together.
2. All module workflows and immutable data/API contracts remain intact; no unresolved critical/high access, data-loss or task-blocking defect.
3. Both themes, desktop/mobile, keyboard and representative screen-reader checks are recorded; accessibility gaps are explicit, not concealed by test automation.
4. Required focused checks and final full CI pass; remaining legacy line-limit violations are enumerated and not increased.
5. All UI copy is English, capability statements are accurate, future features remain out of scope, and no demo/provider/production side effects occurred.
6. Reviewer confirms a scoped diff and accepted pilot patterns before each family rollout; request owner design/scope review only for a material change. Commit/push still require the owner's authorization.

Keep each accepted packet independently reviewable. If a pattern regresses a working flow, correct or revert **that reviewed packet** with owner coordination; never reset the worktree or overwrite someone else's dirty work. No schema/data migrations means presentation rollback must not require a database restore. Record the last accepted UI packet in the handoff so another model can continue without reconstructing the whole conversation.

## 11. DeepSeek assignment

Give DeepSeek [the copy-ready UI0 prompt](deepseek-prompts/UI0-ui-redesign.md), this plan and repository access. This is a prepared handoff, **not a claim that DeepSeek has received or executed it**.

For this assignment, the owner's 24 October request supersedes the old delivery document's blanket “Claude only” implementer note. Current English-only/connected-only rules supersede its historical Arabic/RTL and demo assumptions. Existing business decisions remain authoritative; the UI plan does not reopen them.
