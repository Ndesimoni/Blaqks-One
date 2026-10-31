<!-- # Development guidance

- The active application is React 18 + Vite under `src/`. Start with `README.md` and `docs/architecture.md`.
- Keep feature-specific pages in `apps/crm/src/features`, shared UI in `apps/crm/src/components/ui`, layout in `apps/crm/src/components/layout`, and non-React business logic in `apps/crm/src/lib`.
- Use the focused hooks in `hooks/useWorkspace.js` for records, actions, navigation, view state, and preferences. Define React components at module scope.
- Preserve browser storage keys, workbook field keys/column mappings, and JSON backup formats unless a requested change includes a migration.
- `apps/crm/public/` contains static assets for Vite. `legacy/offline/` is an independent archived implementation; only change it when the request concerns that edition.
- Historical Python scripts in `legacy/offline/tests` are reference material. Active tests are in root `tests/`.
- Use the existing Prettier and EditorConfig settings.
- Validate structural and business-logic changes with `npm test` and `npm run build`. Use `npm run test:e2e` for UI flows and component wiring.
- Browser tests start their own Vite server on port 5174. `PLAYWRIGHT_CHANNEL=chrome` selects an installed Google Chrome without downloading Chromium. -->

# Keys with Simoni — Real Estate CRM

## Project

Professional real estate CRM focused on the UAE market.

## Technology

- React 18 and Vite
- Rust/Axum for the private CRM API and retained Google Calendar companion
- JavaScript and CSS
- PostgreSQL connected mode (the product); browser-local demo frozen since 2026-10-14
- PostgreSQL 17 through Docker Compose for local CRM development and isolated API tests
- Excel import/export
- JSON backup with property media

## Existing Features

- 19 CRM screens covering the original 17-sheet workbook and messaging preview
- Dashboard and analytics
- Client and lead management
- Properties for sale and rent
- Holiday homes and commercial listings
- Off-plan and secondary properties
- Property photos, floor plans and amenities
- Lead qualification and scoring
- Follow-ups and viewing management
- Local follow-up/viewing schedules; Google Calendar integration is deferred
- Deals, commissions and expenses
- Light and dark mode
- Frontend email/password sign-in preview for Aidah and Simoni, both Admins
- Super Admin/team/role preview, required phone numbers and separate WhatsApp/email permissions; see docs/team-access-preview.md
- Private member workspaces, Super Admin workspace directory and scoped activity history; see docs/private-workspaces.md
- Single/bulk email and WhatsApp message composers with client shortcuts, categorized recipient search and removable chips; see docs/messaging-preview.md
- Connected team chat: Admin-created channels (#general for every company), private one-to-one messages and private groups the Admin cannot read, and in-app @mentions; see docs/team-chat.md
- Cross-company deal agreements (hand-over, referral, co-broking) with frozen, evidence-bearing revisions on an Agreements screen; see docs/agreements-design.md
- Sharing one record with a colleague (R1), and a listing with an agent at another company: view only, until a chosen day, recorded as proof of introduction (R2a), which either named person can turn into a co-broking agreement; see docs/record-sharing.md
- Broker marketplace MK1: a company applies with its eligibility checklist, the Blaqks One Super Admin approves, declines or revokes, the company Admin turns it on or off, and members join with a profile, photo, four commitments, publication consent and versioned terms; see docs/broker-marketplace.md
- Responsive desktop/mobile interface
- Opt-in connected Clients, Contacts, Properties, Leads, Follow-ups, Viewings, Shortlist, Interaction log, Client care, Deals, Payments and Expenses with server sessions, scoped CRUD, optimistic versions, redacted transactional activity and assigned-only staff visibility; see docs/backend-foundation.md and docs/assignments-design.md

## Current Project Structure

The CRM frontend lives in `apps/crm/` (an npm workspace); run every `npm run` command from the repository root, which keeps the shared `.env`.

- apps/crm/src/app/ — Application composition, React Router routes, and focused workspace contexts
- apps/crm/src/features/ — CRM pages and feature-specific components
- apps/crm/src/components/ — Shared UI and layout components
- apps/crm/src/hooks/ — Workspace access, data persistence, and preferences hooks
- apps/crm/src/services/storage/ — Validated browser storage repositories
- apps/crm/src/services/files/ — Backup validation and browser downloads
- apps/crm/src/services/crm/ — Same-origin API client; cookie sessions and in-memory CSRF
- apps/crm/src/features/server/ — Connected shell, identity and asynchronous scoped record hooks
- apps/crm/src/lib/ — Business rules, selectors, media, and Excel utilities
- apps/crm/src/config/ — Navigation, table columns, field options (split under apps/crm/src/config/fields/), themes, and storage constants
- apps/crm/src/styles/index.css — Ordered stylesheet imports; maintain the cascade when editing the imported files
- apps/crm/src/data/schemas.js — Workbook data definitions, re-exported from per-sheet modules in apps/crm/src/data/schemas/ (column letters derived in order; append new workbook columns at the end)
- apps/crm/src/data/demo.js — Demo records
- apps/crm/src/main.jsx — React entry point
- apps/crm/tests/ — Active unit, storage contract, API, browser, and offline smoke checks
- apps/website/ — Next.js general website and company websites
- docs/architecture-audit.md — Architecture findings and staged refactoring plan
- services/calendar-companion/ — Retained local Rust/Axum Google Calendar companion: `api/` handlers, `google/` transport, `store/` encrypted storage, `sync.rs` worker
- services/crm-api/ — Private Rust/Axum CRM service, PostgreSQL migrations and trusted account CLI; see [module map](docs/backend-foundation.md#module-map). Add new backend domains as sibling modules under `src/`; group a module into subfolders once it holds several workflows
- compose.yaml / compose.test.yaml — Persistent development PostgreSQL and disposable test PostgreSQL
- docs/google-calendar.md — Account setup, syncing behavior, and integration verification
- docs/service-boundaries.md — Backend table ownership, coupling inventory, boundary rules and the future service-split plan
- docs/agreements-design.md — Agreement types, revision lifecycle, verification levels and the authorization matrix for cross-company deals

## Engineering Standards

Act as a senior software engineer and UI/UX designer.

- Read and follow [Product design standards](docs/design-standards.md) before changing any screen, component or interaction. These standards apply throughout the CRM and to every agent working here.
- Treat the current CRM refresh as the user-approved visual baseline. Follow the [approved visual direction](docs/design-standards.md#approved-visual-direction) and [reference previews](docs/design-refresh.md#visual-previews) for all new and updated screens, including colours, typography, spacing, shared controls, scrolling and interaction states.
- Keep every hand-written code file at **150 physical lines or fewer after formatting**, including imports, comments and blank lines. This applies to components, hooks, business logic, styles, schemas, demo data, tests, scripts and configuration; it also applies to backend code when that phase resumes. Generated artifacts, lockfiles and prose documentation are excluded.
- Split files by responsibility before adding code that exceeds the limit. Keep feature components together, extract hooks/selectors/services appropriately, and preserve CSS import order. Never compress statements, remove useful formatting or create numbered fragments to bypass the limit.
- Run `npm run check:lines`. Existing oversized files are outstanding refactoring work, not exemptions. If a task changes one, split it safely within that task; report any remaining repository violations explicitly. Do not claim the size check passes until it exits successfully.
- Preserve working features during refactoring.
- Resolve workspace access before reading records. In connected mode, Admins use their own workspace and staff use the workspace assigned by their owning Admin; only the Super Admin may open other teams. Resolve membership and permissions from the server on every request. The independent demo retains its per-member workspace keys. Keep every linked CRM collection, recipient directory, report and export within the selected workspace.
- Original `kws-crm-v1` records belong to the Super Admin organisation workspace. Personal records and targets use per-member keys. Never copy organisation records into a member's workspace; Aidah's fresh fictional examples are generated independently.
- Store demo activity alongside the affected workspace envelope. Connected activity must commit transactionally with scoped record mutations. Keep actor and workspace IDs distinct, and never store message bodies, recipient addresses, passwords or provider tokens in activity. Default demo isolation remains a preview; connected access must be enforced by the API.
- Use Docker for PostgreSQL. Integration tests must use the disposable test project, never development or user data. Preserve development volumes during routine verification.
- Keep connected identity and records separate from the demo. Server errors must never fall back to demo accounts or browser records. No automatic migration of browser records.
- Admins may invite and manage staff only inside their own team. Only the Super Admin may invite Admin accounts; the verified public sign-up flow may create only the owning Admin of a new company. Never offer Super Admin creation or promotion in member forms. Multiple staff positions set permission defaults; explicit module and messaging grants remain separate. See [Admin-owned teams](docs/admin-owned-teams.md).
- Normal account deletion archives identity and data without removing saved records. Only the Super Admin can archive accounts; archiving an Admin archives their whole team and freezes that workspace. Keep archived accounts out of current lists and expose their data only through Super Admin read-only views. Revoke sessions/invitations transactionally, check live membership after workspace locks, and never allow an edit/renewal to restore an archive. Hard deletion is a separate future feature requiring explicit permanent-loss review.
- Browser/backup imports require the live Super Admin, explicit source/destination review and an atomic add-only commit. Organisation sources stay in the organisation workspace; personal sources require an explicitly selected server member UUID. Preserve every source collection in full backups; only the eight connected collections currently migrate. See [Data migration](docs/data-migration.md).
- Demo listing photos must stay labelled. Display fallbacks never alter stored browser records; imports may embed deterministic sample assets only for empty galleries. Preserve actual photos and floor plans. See [Demo property photos](docs/demo-property-photos.md).
- Follow [Service boundaries](docs/service-boundaries.md): each table has one owning backend module and other modules use its functions, not its tables; new cross-domain foreign keys, triggers or shared-table writes need a decision-log entry; build new large features (agreements, messaging/integrations, public catalogue, lead agents) as separately owned modules with their own tables, routes and `apps/crm/src/services/crm/` client file.
- New work keeps the current colour theme and follows [Premium polish for new work](docs/design-standards.md#premium-polish-for-new-work-owner-2026-10-16) (owner, 2026-10-16).
- **Everything is in English** ([English only](docs/product-decisions.md#english-only-decided-2026-10-22), owner 2026-10-22): write no Arabic text, Arabic translations, right-to-left layouts or Arabic-specific handling. New interface text goes in the English catalogue through `useI18n()` (`npm run check:i18n` checks English only). The existing Arabic catalogue and its preview stay in place, frozen and switched off: do not update or delete them without a separate owner decision.
- Prefer reusable components and custom hooks.
- Separate UI, business logic and data access.
- Use consistent typography and spacing.
- Maintain light and dark theme support.
- Choose list presentation by task: paginated primary records, continuous scrolling for searchable lists, and six-item More disclosure for compact summaries. Use `components/ui/OverflowList.jsx` modes; expanded disclosure replaces the compact list without duplicating items or leaving a More button above it. Keep full collections in the model; see docs/option-overflow.md.
- Design mobile-first, accessible interfaces.
- Validate forms and handle errors.
- Avoid unnecessary dependencies.
- Test changes before marking work complete.

## Development Agents

Use the eight project specialists in `.codex/agents/` through the [Development agent workflow](docs/development-agents.md). These are development roles, separate from CRM user accounts.

Use the owner-approved [token-efficient delivery protocol](docs/token-efficient-delivery.md): one bounded packet per fresh session, proportionate specialists, focused local checks, full suites in CI and compact progress reports.

- Delegate focused work to the relevant specialist when it benefits the task. The primary agent owns the user's scope, coordinates work, checks results and completes the task.
- For the frontend phase, use `senior_architect`, `product_designer`, `frontend_engineer` and `qa_accessibility`. Include `security_engineer` for access, storage, authentication or data-exposure changes; use `devops_release` for assigned frontend CI work.
- `backend_database` and `integrations_engineer` are available for explicitly assigned later-phase work. Creating the agents does not start backend development, provider connections or external delivery.
- Give each specialist a concrete task, affected files/contracts, acceptance criteria, allowed write set and required checks. Keep architecture, design and security reviews separate from implementation.
- Run at most three specialists alongside the primary agent, within the session's actual limits. Parallelise independent reads and disjoint write sets; coordinate shared styles, configuration and fixed-port browser suites.
- Specialists report evidence and limitations to the primary agent and do not start nested agents. In sessions without custom-agent discovery, read the relevant TOML instructions and include them in the delegated task; live session permissions still apply.
- Follow existing task authorization. Agent handoffs and reviews do not introduce another user-confirmation step for work the user already authorized.

## Roadmap

The user has authorised backend development. The first local CRM backend slice is implemented in `services/crm-api/` with Docker PostgreSQL and opt-in `VITE_CRM_MODE=server`; see [Backend foundation](docs/backend-foundation.md). Connected mode includes Clients, Contacts, Properties, Leads, Follow-ups, Viewings, Shortlist, Interaction log and Client care (Leads is a view over Clients), plus Deals, Payments and Expenses on dedicated typed finance tables with action permissions and approvals; see [Finance design](docs/finance-design.md). Finance data is not yet part of browser/backup imports. Run CRM Rust tests, formatting and Clippy plus `npm run test:api` or `npm run test:server:e2e` for API changes.

**Connected-only development (owner decision 2026-10-14).** The connected version is the product. The browser-local demo is **frozen**: do not add demo-specific features, demo data or demo browser tests, and do not run `npm run test:e2e` as a routine check. Keep demo code in place (shared components still serve both modes) and do not delete or deliberately break it without a separate owner decision. Verify work with `npm test`, `npm run build`, `npm run test:api`, `npm run test:server:e2e`, `npm run check:lines` and `npm run check:boundaries`; GitHub Actions CI (`.github/workflows/ci.yml`) runs these on every pull request and push to `main`. Where real data is missing, use clearly fictional synthetic data: tests seed their own records in the disposable Docker database, and developers may fill a local workspace with the sample-data command; never use real client data for testing.

Calendar navigation, connection controls and background sync remain removed from the active frontend; retain scheduling metadata and the companion for a later phase. Default demo browser tests start only Vite; connected browser tests use their own API and isolated Docker database. Historical Calendar browser scenarios are in `apps/crm/tests/deferred/` and are excluded from the active suite.

Follow the owner's [product decisions](docs/product-decisions.md) (record visibility, assignment, listing limits and enquiry routing); they override the roadmap's suggested defaults. The current plan is the [implementation roadmap](docs/claude-implementation-roadmap.md); start each new session with the [handoff](docs/handoff.md), which lists the latest finished work, the next packets and how a packet is run. See the proposed [CRM, website and mobile platform design](docs/platform-system-design.md). The owner removed mandatory website publication approval on 2026-10-28: follow [direct website publishing](docs/product-decisions.md#direct-website-publishing-decided-2026-10-28), with scoped Publish permission and validation rather than a human approval queue. Keep private CRM data separate from deliberately published public versions and preserve enquiry ownership. The owner subsequently authorised website backend development: the [local website backend](docs/website-backend.md) implements public catalogue, direct publishing and targeted enquiries. CRM Website management screens, deployment and the documented launch work remain; social-provider delivery is separate later work.

The frontend foundations are implemented; see `docs/frontend-completion.md`. Node 20 or later is required by the patched router dependency. Complete the remaining scoped CRM modules, live team flows, private media storage and publication/enquiry pipeline before hosted deployment. If work on the retained Calendar backend is explicitly requested, verify it with `npm run test:calendar`, relevant browser checks, `cargo fmt`, and Clippy in addition to the standard checks (Rust 1.89+).

1. Refactor monolithic React components.
2. Improve property-management workflows.
3. Improve client and lead management.
4. Introduce React Router and feature modules.
5. Build Rust Axum REST API.
6. Integrate PostgreSQL.
7. Add authentication and authorization.
8. Add secure cloud media storage.
9. Deploy production application.

## Important

The browser-local demo is frozen (see Roadmap); the connected version is the product. Its sign-in uses public sample credentials and a tab-local identity, not server authentication. Connected mode uses server-created accounts and PostgreSQL sessions with enforced workspace access; it is a local development foundation, not a deployed production service. See `docs/frontend-sign-in.md`; never put real passwords into the demo account configuration.
Demo team configuration is separate under `kws-crm-team-preview-v1`; keep passwords/provider tokens out of it and preserve CRM/workbook/backup contracts. Messaging and invitation previews never deliver externally. Demo roles control frontend modules; connected roles and access come from the server.
Do not treat the demo or first connected slice as a complete production multi-user CRM. Additional roles, account recovery, provider delivery, object storage, operations and deployment remain unfinished.
Do not remove existing data features without approval.
