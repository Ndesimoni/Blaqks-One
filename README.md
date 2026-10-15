# Keys with Simoni CRM

Real estate CRM v1.2, built with React 18 and Vite. The application covers the 17 worksheets in the original workbook, including clients, properties, viewings, deals, commissions, and reports.

## Run locally

Use Node.js 20 or later (Node 22 recommended) and npm. Open this project folder in VS Code, then run:

```bash
npm install
npm run dev
```

Open <http://localhost:5173>. See [Getting started](docs/getting-started.md) for the VS Code setup. The default mode remains the browser demo. For the new Rust API, Docker PostgreSQL, real account sign-in and connected Clients/Contacts/Properties, follow [Backend foundation](docs/backend-foundation.md).

The Super Admin can now [save and import existing records](docs/data-migration.md), with complete JSON source backups, a reviewed add-only PostgreSQL import and preserved ownership. Properties without uploaded pictures show [labelled demo photos](docs/demo-property-photos.md); existing pictures stay intact.

Connected mode supports [Admin-owned teams](docs/admin-owned-teams.md): the Super Admin invites Admins, each Admin invites staff into their own workspace, and staff receive reviewed module access, multiple positions and separate email/WhatsApp permissions. Members activate private one-use links and choose their own passwords. Invitations are shared manually; provider delivery remains deferred.

Connected navigation includes the familiar Workspace, Sales & relationships, Finance & analytics, Resources and Settings groups. Working Clients, Leads, Contacts, Properties, Follow-ups, Viewings, Shortlist, Interaction log, Client care and Team screens retain their server data; unfinished sections show **Not connected** and open a status screen. Restoring navigation does not connect those remaining modules or load the browser demo's records.

The demo frontend opens with email/password sign-in. Initially, use `aidah@keyswithsimoni.test` or `simoni@keyswithsimoni.test` with the public demo password `SimoniDemo2026!`; both have full Admin operations within separate personal workspaces. Aidah has fresh fictional examples; other members start empty. The previous shared records belong to the Super Admin workspace. Open **Settings → Team & access** to prototype Super Admin setup, invited members, required phone numbers and separate WhatsApp/email permissions. See [Private workspaces and team activity](docs/private-workspaces.md), [Team and messaging preview](docs/team-access-preview.md) and [Frontend sign-in](docs/frontend-sign-in.md). Connected mode supplies server authentication for its first three modules; demo accounts and message previews remain separate.

## Project structure

```text
src/
  app/                  Application shell, routed feature pages, and focused contexts
  components/
    layout/             Header, sidebar, page heading, and branding
    ui/                 Shared buttons, badges, icons, and display components
  config/               Navigation, field options, theme, and storage constants
  data/                 Original workbook schemas and fictional demo records
  features/
    auth/               Frontend sign-in, session routes, and admin profile controls
    calendar/           Local schedule helpers and deferred Google integration source
    clients/            Client desk and property matching
    dashboard/          Overview and KPIs
    guide/              In-app workflow guide
    insights/           CRM intelligence
    properties/         Property directory, media editor/gallery, and selectors
    records/            Shared tables/forms, validation, and record commands
    server/             Opt-in connected shell, sessions and asynchronous scoped records
    reports/            Date search and performance targets
    team/               Owner setup, invitations, roles, profiles and access rules
    workspaces/         Personal CRM scopes and Super Admin workspace directory
    activity/           Scoped action history, filters and attribution
    messaging/          Single/bulk client composers and staff message previews
  hooks/                Focused state access, actions, navigation, and persistence
  lib/                  Business rules, workspace selectors, media, and Excel
  services/
    auth/               Demo credential adapter, replaceable with server authentication
    crm/                Same-origin cookie/CSRF API client
    files/              Backup validation and browser downloads
    storage/            Browser workspace and preference repositories
  styles/               Ordered foundation, workspace, responsive, theme, and media styles
  main.jsx              React entry point
public/                 Favicon and original downloadable workbook
tests/
  api/                  Real HTTP/PostgreSQL tests against an isolated Docker database
  browser/              Playwright tests for the default demo
  server-browser/       Browser-to-API-to-PostgreSQL connected scenarios
  fixtures/             Sample files used by tests
  smoke/                Offline edition smoke checks
  unit/                 Business, selector, and storage contract tests
scripts/                Local CRM setup/account/test commands and offline build
docs/                   Setup, architecture, product guide, and screenshots
legacy/offline/         Preserved independent offline prototype
backend/                Retained Rust/Axum Google Calendar companion
services/crm-api/       Rust/Axum private CRM service and PostgreSQL migrations
compose.yaml           Persistent local Docker PostgreSQL
compose.test.yaml      Disposable isolated test PostgreSQL
```

The entry point [`src/main.jsx`](src/main.jsx) selects the default demo in `src/app/App.jsx` or connected mode in `src/features/server/ServerApp.jsx`. Read [Architecture](docs/architecture.md) before adding a feature.

All UI work follows the [Product design standards](docs/design-standards.md) and agent rules in [AGENTS.md](AGENTS.md). Hand-written code files have a maximum of 150 formatted lines. `npm run check:lines` reports outstanding violations; existing oversized files must be split when they are changed.

Eight project development agents are defined in `.codex/agents/`, covering architecture, product design, frontend, QA/accessibility, security, backend/database, DevOps and integrations. See [Development agent workflow](docs/development-agents.md) for responsibilities, handoffs, invocation examples and client compatibility.

The proposed [CRM, website and mobile platform design](docs/platform-system-design.md) connects private CRM workspaces to one approved public catalogue and routes customer enquiries to the listing owner's CRM. Super Admin approval is required before listings become public; the first private backend slice is implemented, while the public catalogue, website and mobile app remain future implementation work.

The [CRM design refresh](docs/design-refresh.md) implements consistent colours, controls, forms and motion, compact dashboard/property layouts, persistent sidebar settings and mobile workspace search. The dashboard and property directory now compose focused components, and shared styles use ordered responsibility-based files.

The [Architecture audit](docs/architecture-audit.md) preserves the initial findings. [Frontend completion](docs/frontend-completion.md) records the implemented foundations and validation results. All 19 CRM screens and four settings/workspace screens have reload-safe hash routes, such as `/#/properties`, with browser back/forward support. The Leads section at `/#/leads` shows contact details, lead sources, campaign references, and enquiry stages, with source totals and filters. Six source filters appear initially, including All sources; More opens a scrollable menu containing every source and All sources. Selecting a source, clicking outside, pressing Escape, or using its close button dismisses the menu and keeps More available. The active source stays visible among the six filters. Leads share their existing client profile within their owner's workspace, so updates stay connected to follow-ups, deals, and the original 17-sheet Excel export.

**Settings → Workspaces** lets the Super Admin see totals and open every member's CRM. **Settings → Team activity** shows who changed which record and when; members see only their own workspace history. Imports, exports, reports and recipient searches stay within the selected workspace. This is frontend isolation in one browser; the backend must enforce actual data access. See [Private workspaces and team activity](docs/private-workspaces.md).

**Messages → Start a message** previews Email or WhatsApp for one or several recipients. Click the recipient field to search and filter saved **Clients**, **Leads** and **Landlords**, or paste addresses/numbers manually. Select multiple people and remove them with recipient chips, then write and review. Client/lead rows, record details and the Client desk offer the same **Start message** flow with contact details pre-filled. Channel permissions, recipient validation and duplicate removal across categories apply; live delivery is not connected. See [Messaging preview](docs/messaging-preview.md).

Property cards use one paginated grid with 12 items per page. Recipient searches, client choices and activity results scroll continuously; photo thumbnails and form steps scroll horizontally. Compact recipient chips and amenity summaries use More to replace their six-item preview with one complete list and a close control. Selections and complete drafts are retained. See [Clean collection and option browsing](docs/option-overflow.md).

## Commands

| Command                   | Purpose                                                       |
| ------------------------- | ------------------------------------------------------------- |
| `npm run setup:crm`       | Generate private local CRM database configuration             |
| `npm run db:up`           | Start Docker PostgreSQL and wait for readiness                |
| `npm run db:migrate`      | Apply pending CRM database migrations without an API listener |
| `npm run db:stop`         | Stop PostgreSQL, preserving its volume                        |
| `npm run dev:api`         | Start the Rust CRM API                                        |
| `npm run crm:create-user` | Create a live account through hidden terminal password input  |
| `npm run demo:backup`     | Generate a complete fictional JSON backup with sample photos  |
| `npm run test:api`        | Run isolated Docker HTTP/database tests                       |
| `npm run test:server:e2e` | Run API tests and connected browser scenarios                 |
| `npm run dev`             | Start Vite with live reload                                   |
| `npm run build`           | Generate the modern application in `dist/`                    |
| `npm run preview`         | Serve the production build on port 4173                       |
| `npm test`                | Run unit/contract tests and offline smoke checks              |
| `npm run test:unit`       | Run business, selector, and storage contract tests            |
| `npm run test:e2e`        | Run browser tests with an isolated Vite server on port 5174   |
| `npm run check:lines`     | Enforce the 150-line limit and list existing violations       |
| `npm run format`          | Format active source, configuration, and documentation        |
| `npm run format:check`    | Check formatting                                              |
| `npm run offline`         | Serve the preserved offline edition on port 4173              |
| `npm run build:offline`   | Rebuild the offline edition from its separate source          |

The frontend browser suite starts only Vite and requires no backend service. Install Playwright's Chromium once:

```bash
npx playwright install chromium
npm run test:e2e
```

If Google Chrome is already installed, you can use it instead:

```bash
PLAYWRIGHT_CHANNEL=chrome npm run test:e2e
```

Formatting settings are shared through `.editorconfig` and `.prettierrc.json`. VS Code uses the recommended Prettier extension to format on save.

## Data and offline edition

In demo mode, records and property attachments use this browser's local storage. Full JSON backups include photos and floor plans; Excel exports include record fields and reports. The existing storage keys and backup formats are retained.

The CRM starts in dark mode by default. Use the header theme switch to choose light mode; your selection is saved for future visits.

Calendar remains deferred while development proceeds with the private CRM backend. The menu and connection controls are removed, and the frontend makes no Calendar API requests. Follow-ups and viewings still save local dates, times, durations and locations. Existing scheduling metadata and full JSON backups remain compatible; Excel keeps the original workbook format. Companion source and integration scenarios are retained for a later phase; see [Deferred Google Calendar integration](docs/google-calendar.md).

Unreadable saved records open a recovery screen that leaves the original data untouched. Download that data before explicitly replacing it. Failed saves show an export/retry banner; edits stay in memory until saving succeeds. Forms validate input and protect unsaved edits during drawer closing, navigation, and page exit.

The offline edition is documented in [`legacy/offline/README.md`](legacy/offline/README.md). Its independent assets stay outside Vite's production build.

See the [Implementation roadmap](docs/claude-implementation-roadmap.md) for planned features and implementation phases, and [Third-party notices](THIRD_PARTY_NOTICES.md) for bundled library notices.
