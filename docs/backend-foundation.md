# Private CRM backend foundation

The connected foundation is implemented in `services/crm-api/` using Rust/Axum and Docker PostgreSQL. It supports real email/password sign-in, Admin-owned private workspaces, team invitations and module permissions, and CRUD for Clients, Contacts, Properties, Follow-ups, Viewings, Shortlist, Interaction log and Client care. The Leads screen is a filtered view over connected Clients. See [Admin-owned teams](admin-owned-teams.md). The default application remains the complete browser-local demo. Other CRM data screens have not yet moved to PostgreSQL.

This is a local development foundation, not a deployed production service. The Super Admin can now review and import existing connected collections from browser storage or a full JSON backup; see [Save and import records](data-migration.md). It does not connect Calendar, social accounts, email or WhatsApp, or publish properties.

## Run locally

Use Node 20+ (22 recommended), Rust 1.89+ and Docker Desktop with Compose. Start Docker Desktop first. From the project root:

```bash
npm install
npm run setup:crm
npm run db:up
npm run crm:create-user
```

The setup script creates a private, ignored `.env` with a random database password and restrictive file permissions. It never overwrites an existing `.env`. For manual configuration use `.env.example` and replace both password placeholders consistently. Never put account passwords or provider tokens in Vite variables or demo account configuration.

Initial account creation runs in an interactive terminal. Enter a name, real account email, international phone number and role `super-admin` for the first account. Choose a password of at least 8 characters; password input is hidden and sent to the Rust process over standard input. No built-in live accounts or default account password exist. After signing in, the Super Admin can invite Admins through **Team**, and each Admin can invite staff to their own workspace. The operator CLI also supports creating Admins. The database allows only one Super Admin. Demo profiles Aidah and Simoni do not automatically become live accounts.

Start the API in one terminal:

```bash
npm run dev:api
```

Start the connected frontend in another:

```bash
VITE_CRM_MODE=server npm run dev -- --host 127.0.0.1
```

Open **http://localhost:5173** and sign in with an account created above. Use this exact origin, including the port; it must match `CRM_APP_ORIGIN`. The API listens on `127.0.0.1:8788`; Vite forwards `/api/crm` to it. The development server now defaults to a loopback bind. For a permanent local switch, set `VITE_CRM_MODE=server` in `.env` and restart Vite. `npm run dev` without that override uses the saved mode; setup defaults to `demo`.

If port 5173 is occupied, stop the conflicting development server or change the Vite port and `CRM_APP_ORIGIN` together. If the API port changes, update `CRM_BIND_ADDRESS` and `CRM_API_PROXY` together.

## Module map

`services/crm-api/src/` is grouped by domain. Shared infrastructure stays at the crate root.

| Path                                                                        | Responsibility                                                                                  |
| --------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `main.rs`, `bootstrap.rs`, `config.rs`, `state.rs`, `error.rs`, `routes.rs` | Startup, account CLI, configuration, shared state, API errors and the route table               |
| `auth/`                                                                     | Passwords, sessions, login throttling, Origin/CSRF protection, profiles and module permissions  |
| `workspaces/`                                                               | Workspace locks and access guards (`mod.rs`); directory and activity endpoints (`handlers.rs`)  |
| `records/`                                                                  | Connected collection definitions, CRUD handlers, transactional mutation/deletion and activity   |
| `records/validation/`                                                       | Record shape, reserved fields, numeric ranges, scalar workbook fields and media checks          |
| `imports/`                                                                  | Super Admin import preview, planning, credential rejection and atomic commit                    |
| `team/`                                                                     | Role catalogue, team access and validation; `invitations/`, `members/` and `archive/` workflows |

New domains from the [roadmap](claude-implementation-roadmap.md#suggested-future-module-locations) become sibling folders under `src/`. Within a group, modules import each other through `super::`; cross-group imports use `crate::` paths.

## Docker database

`compose.yaml` runs PostgreSQL 17 on **127.0.0.1:55432**, with database/user `kws_crm`. It uses SCRAM host authentication, a health check and the named `keys-with-simoni_crm-postgres` volume. There is no host PostgreSQL dependency.

`npm run db:stop` stops PostgreSQL while preserving that volume. `npm run db:up` starts it again. Do not use `docker compose down -v` unless intentionally deleting this development database. Changing the password in `.env` does not change credentials inside an existing PostgreSQL volume; coordinate any credential rotation with the database.

The API applies versioned SQL migrations before serving requests or creating an account. The Compose user is the local development database administrator. A hosted deployment needs separate migration and restricted runtime database roles, managed secrets, backups and restore verification.

## Data and access contracts

- Each Admin owns a workspace identified by their server user UUID. Staff share their owning Admin's workspace with explicit module permissions. The API authenticates active membership and resolves workspace access and collection permissions before querying or mutating records. Forging another team's workspace or record ID cannot grant access.
- The Super Admin can open all permitted workspaces through the workspace selector, including `super-admin-workspace`. An edit in another Admin's workspace stays owned by that workspace; the audit actor remains the Super Admin.
- Original workbook IDs (`client_id`, `contact_id`, `property_id`) and field names remain inside each JSON record. Separate server UUIDs and positive versions identify API records. Unknown compatibility fields are retained; reserved server ownership/approval fields and invalid rendered workbook values are rejected.
- Legacy IDs are unique within their collection and workspace. Properties can reference only Contacts in the same workspace, and Follow-ups, Viewings, Shortlist, Interaction log and Client care can reference only Clients and Properties in the same workspace (`client_id`, `property_id` or `property_id_optional`), enforced by composite database foreign keys (migration 6). Delete or unlink dependent records before deleting or renaming a linked Contact, Client or Property. Interaction log `deal_id_optional` and Client care `referred_client_id` are stored but not yet enforced.
- Record creation, updates, deletion and redacted activity commit in one transaction. Activity records actor, workspace, collection, server record ID, action and time. They exclude message bodies, recipient addresses, record names, credentials and tokens. A database trigger rejects activity updates/deletes; database operators still control the database.
- Updates and deletes require the current `version`. A stale request returns HTTP 409 with `code: version_conflict`. The editor retains its draft and offers explicit reload; duplicate IDs and linked-record conflicts show their own errors.
- Connected records and identities are not stored in browser local/session storage. Theme preference is shared with the demo. Server failure shows a retry state; an authoritative 401 clears the connected identity and workspace cache.
- Existing demo storage keys, workbook exports and JSON backup formats remain intact. There is no automatic copying of organisation or personal browser records into the database. The Super Admin import flow downloads complete source backups, previews the eight connected collections and commits an add-only migration. Connected record export is still pending.

## Authentication boundary

Passwords use salted Argon2id with 19 MiB memory, two iterations and parallelism one. Session cookies contain random opaque identifiers; the database stores their SHA-256 hashes. Sessions expire after eight hours, are revoked on logout, and check user activity on each request. Cookies use `HttpOnly`, `SameSite=Strict` and `/api/crm` scope. Mutations require the configured exact browser Origin and a session-bound CSRF token kept in memory.

HTTPS and Secure cookies are required by default. The explicit `CRM_ALLOW_INSECURE_LOCAL=true` development setting accepts only loopback HTTP origins and loopback API binds. It is not a hosted deployment setting.

Password verification uses a bounded worker pool. A PostgreSQL-backed 15-minute login budget limits each email to 10 attempts and the service to 100 attempts. Before public hosting, add trusted-source abuse protection and tune limits to avoid a shared global budget becoming a denial-of-service target. Origin checking complements authentication; it does not authenticate non-browser clients.

Connected team invitations and activation, eight staff positions, multiple positions per person, module/channel grants and scoped staff suspension are implemented. Only the Super Admin can invite Admins; Admins manage only their own staff. The older browser-local team flow remains a separate preview. Account recovery, email verification, MFA, account email/password editing and live provider delivery remain unfinished.

## Media boundary

The shared photo/floor-plan editor works in connected mode. Small inline assets are currently saved in the private record JSON. The API caps record size at 12 MiB, validates asset shape and supported JPEG/PNG/WebP/PDF data URLs, and rejects executable schemes and SVG uploads. It does not decode, scan or re-encode uploaded files. Before production, replace inline media with private object storage, validated upload processing and approved public derivatives. Public publication is not available through these CRUD endpoints.

## API surface

All routes are under `/api/crm`. Private responses use `Cache-Control: no-store`.

| Route                                                   | Behaviour                                                                                       |
| ------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `GET /health`                                           | Database readiness                                                                              |
| `POST /auth/login`                                      | Email/password; sets session cookie; returns profile and CSRF token                             |
| `GET /auth/session`                                     | Active profile and session CSRF token                                                           |
| `POST /auth/logout`                                     | Revokes current session and clears cookie                                                       |
| `GET /workspaces`                                       | Authorised workspace directory                                                                  |
| `GET /workspaces/:workspace/records`                    | Scoped arrays for every connected collection the user may access                                |
| `POST /workspaces/:workspace/records/:collection`       | Create `{ record }`; returns HTTP 201                                                           |
| `PATCH /workspaces/:workspace/records/:collection/:id`  | Replace `{ record, version }`; returns updated version                                          |
| `DELETE /workspaces/:workspace/records/:collection/:id` | Delete with `{ version }`                                                                       |
| `GET /workspaces/:workspace/activity`                   | Latest 100 redacted actions in that workspace                                                   |
| `POST /workspaces/:workspace/imports/preview`           | Super Admin validates `{ sourceWorkspaceId, records }` and receives scoped preview token/counts |
| `POST /workspaces/:workspace/imports/commit`            | Super Admin commits `{ token }` atomically; same-token retries return saved result              |

Record responses have `{ id, version, record }`. The first slice loads a workspace's permitted collections together; database pagination, incremental fetching and live change notifications are future scalability work. Activity has an API endpoint but no connected activity screen yet. Team and invitation routes are documented in [Admin-owned teams](admin-owned-teams.md).

## Verification

```bash
npm test
npm run build
VITE_CRM_MODE=server npm run build
cargo test --locked --manifest-path services/crm-api/Cargo.toml
cargo fmt --check --manifest-path services/crm-api/Cargo.toml
cargo clippy --locked --manifest-path services/crm-api/Cargo.toml --all-targets -- -D warnings
npm run test:api
PLAYWRIGHT_CHANNEL=chrome npm run test:server:e2e
PLAYWRIGHT_CHANNEL=chrome npm run test:e2e
npm run check:lines
```

The API harness creates a uniquely named test Compose project with a random password, an ephemeral loopback port and disposable `tmpfs` database storage. It seeds only synthetic accounts, checks real HTTP/database behaviour, restarts the API to verify durable sessions/records, then removes its own test container/network. It never connects to the development database. Browser checks start connected Vite on port 5175 and test persistence, workspace access, failures, optimistic conflicts, media and responsive navigation. The default demo browser suite uses port 5174 and requires no Rust service.

Test scenarios reset rate-limit state only inside the isolated test database. No application authentication limit is weakened. Docker must be running; ports 8790 and 5175 must be free. Test dependencies must be cached for the harness's offline Cargo build; first run `cargo build --locked --manifest-path services/crm-api/Cargo.toml` if needed.

## Completed verification

The implemented slice passed the following checks in the local workspace:

| Check                                                      | Result                                           |
| ---------------------------------------------------------- | ------------------------------------------------ |
| Frontend unit, storage/contract and offline smoke tests    | 108 passed                                       |
| CRM Rust unit and validation tests                         | 22 passed                                        |
| Actual Docker PostgreSQL HTTP tests, including API restart | 48 passed                                        |
| Connected browser stories                                  | 29 passed                                        |
| Complete default demo browser suite                        | 78 passed                                        |
| Default and connected production builds                    | Passed                                           |
| Prettier, Rust formatting, Clippy with warnings denied     | Passed                                           |
| Development Docker/API readiness                           | Healthy PostgreSQL; API health returned HTTP 200 |
| Changed/new code file size                                 | All at or below 150 formatted lines              |
| Whole-repository file size                                 | Fails: 47 existing oversized files remain        |

Connected screenshots were visually inspected for the team invitation form and its visible cancellation and account suspension controls on desktop and mobile, the dark desktop property overlay with a generated demo villa, the import review in both mobile themes, and the earlier workspace/media views. Automated responsive checks cover desktop, tablet and mobile in both themes. Team checks include real invitation activation, Admin creation restrictions, multiple positions, live permission changes, renewed links, immediate cancellation with confirmation, persistence after reload, rejection of cancelled links, failed cancellation recovery, direct suspension/restoration of Admins and staff, revoked sessions and blocked login for a suspended Admin's team, retained records after restoration, keyboard focus, unsaved drafts and scrolling. The Edit flow explicitly checks that **Continue** opens **Roles & access**, where activated accounts expose **Account active**. Colour contrast checks wait for theme transitions to settle and retain the 4.5:1 requirement. Import checks include full source backup downloads, unchanged browser data, uploaded media preservation, explicit personal ownership mapping, lost-response retry and importing the complete generated demo backup. The independent frontend and connected suites use sibling artifact directories so their cleanup cannot remove each other's traces. A sign-out scenario now waits for its asynchronous warning before asserting it; the warning and retention checks remain intact.

This is scoped verification, not an accessibility certification or a claim of complete production readiness. Disposable test containers are removed after each run; the persistent development database is preserved. The initial foundation applied development migrations 1 (identity), 2 (records) and 3 (imports), before the first real account was created. Migration 4 has now been applied to the development database: the existing single Super Admin account and zero CRM records were preserved, with no demo accounts inserted or browser records imported.

Account archival is also verified through the real API and browser: Super Admin authority, typed confirmation, version/team review conflicts, Admin and staff access revocation, pending invitation rejection, immutable read-only archives, preserved linked records and audit, queued-write races, transaction rollback and lost-response recovery. The archive confirmation was inspected at desktop and mobile widths in both themes. Browser scenarios reset only the disposable test database's sign-in budgets; the production rate limiter remains unchanged and is exercised by the API suite. Migration 5 was applied locally with all account, record, workspace, invitation and activity counts unchanged; no existing account was archived or deleted. The local API was restarted and its health and Vite proxy returned HTTP 200. See [Delete and archive accounts](admin-owned-teams.md#delete-and-archive-accounts).

## Next implementation stages

Leads and the client workflow collections (Follow-ups, Viewings, Shortlist, Interaction log, Client care) are now connected. Extend scoped storage and migration to Deals, Payments and Expenses next, linking Payments to Deals and enforcing the Interaction log deal link. Add account recovery, verified email/profile changes and larger batch/media migration paths. Then build exact-version Super Admin approval, a separate approved public catalogue and owner-routed website/mobile enquiries as specified in [Platform system design](platform-system-design.md). Provider connections and verified webhooks follow that foundation; Facebook/Instagram and email/WhatsApp are the initial messaging candidates. TikTok and LinkedIn depend on provider eligibility, while YouTube integration concerns supported engagement APIs. No provider delivery is claimed by this stage.

Connected navigation verification includes all restored groups and Settings, explicit unfinished-section status screens, exclusion of browser-demo records, staff permission restrictions, Dashboard deep links/reload, and active-link scrolling across desktop/mobile resize in both themes. The focused demo navigation/history/drawer regressions also pass. To run only a connected browser scenario against a fresh disposable database, use `PLAYWRIGHT_CHANNEL=chrome npm run test:server:e2e -- --browser-only tests/server-browser/navigation.spec.js`; the regular command continues to run the full API and browser suites.
