# Performance and security plan

Date: 2026-11-08. Status: proposal, not started. Scope: the connected CRM (`apps/crm`,
`services/crm-api`), the two public websites (`apps/website`, `apps/marketing`) and the local
Docker stack.

This plan makes the product secure, safe, fast and responsive at the sizes discussed for
launch: about 1,000 companies with 20 staff each (20,000 accounts), with headroom to
200,000 accounts if the two client/server changes below are made first. It follows
[service boundaries](service-boundaries.md): no new cross-domain tables or foreign keys.

## Targets

- p95 API response under 200 ms for workspace reads on a 4,000-record workspace.
- Initial JavaScript under 250 KB gzipped; first list paint under 1.5 s on simulated 4G.
- No uncompressed JSON above 50 KB; no response above 1 MB outside media.
- Every browser session cookie `Secure`; no security header missing on either site.

## Verified baseline

Measured in the repository on 2026-11-08, not assumed:

- **No Redis anywhere** in `services`, `apps/crm/src`, `docs` or `compose.yaml`.
- **No compression, security headers, request body limit or timeout layer** in
  `services/crm-api` (`tower-http` is not a dependency; only `tower` `util` is).
- **The session cookie has no `Secure` flag**: `HttpOnly; SameSite=Strict; Path=/api/crm`
  (`services/crm-api/src/auth/session.rs:52`).
- **`GET records` returns every record in the workspace with no paging or cursor**
  (`services/crm-api/src/records/list.rs`), so payload grows with the workspace.
- **No client data cache**: `apps/crm` depends only on `react`, `react-dom`,
  `react-router-dom` and `jszip`; each feature refetches on mount through its own
  `AbortController` hook.
- **Connection pools are small**: 10 for the API (`main.rs`), 5 for `messaging_worker`.
- **Media sits on the development SeaweedFS container** in `compose.yaml`.

## Speed

Ordered by expected effect. Items 1-3 carry most of the gain at the launch size.

| #   | Change                                                                                                         | Technology                                                            | Where                                                       | Effect                                                 |
| --- | -------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- | ----------------------------------------------------------- | ------------------------------------------------------ |
| 1   | Cursor-paginate `GET records`; add `(workspace_id, collection, created_at, id)` index                          | Postgres keyset paging                                                | `records/list.rs`, one migration                            | Payload stops growing with workspace size              |
| 2   | Compress responses (brotli, gzip)                                                                              | `tower-http` `CompressionLayer`                                       | `Cargo.toml`, `routes.rs`                                   | 80-90% smaller JSON on the wire                        |
| 3   | Replace per-screen fetches with one query cache: dedupe, `staleTime`, background refetch, optimistic mutations | TanStack Query v5                                                     | `features/server/useServerRecords.js` and the feature hooks | Fewer requests, instant navigation                     |
| 4   | Redis, for three jobs only                                                                                     | `redis-rs` or `deadpool-redis` on managed Redis                       | new                                                         | See below                                              |
| 4a  | Cache session and live membership per request (coupling C8)                                                    | Redis                                                                 | `auth/`, `workspaces/`                                      | Removes 2-3 database reads per request                 |
| 4b  | Distributed login throttling and rate limits                                                                   | Redis                                                                 | `auth/`, `login_limits`                                     | Limits work across replicas                            |
| 4c  | Fan out chat and notification events across API replicas                                                       | Redis pub/sub                                                         | `chat/`, `notifications/`                                   | Enables horizontal scaling of live updates             |
| 5   | Put PgBouncer in front of Postgres; pool 10 to 20-30 per instance                                              | PgBouncer                                                             | deployment                                                  | Room for replicas without exhausting connections       |
| 6   | Partition `crm_activity` by month and workspace, with retention                                                | Native Postgres partitioning                                          | migration                                                   | Keeps the feed and vacuum cheap past 50M rows          |
| 7   | Move media to real object storage with a CDN, sizes and modern formats                                         | Cloudflare R2 or S3, CDN transforms (`imgproxy` or Cloudflare Images) | `media/`                                                    | Faster galleries, lower egress cost, removes SeaweedFS |
| 8   | Property search: Postgres `GIN`/`pg_trgm` first; a search engine only if measured slow                         | Postgres, then Meilisearch                                            | `records/`, `catalogue/`                                    | Keeps the stack small                                  |
| 9   | Move imports, exports, publishing and bulk assignment to the worker                                            | Existing `outbox/` pattern                                            | `imports/`, `publications/`                                 | Stops bulk work holding the workspace lock             |
| 10  | `ETag` and `If-None-Match` on large reads                                                                      | `tower-http`                                                          | `routes.rs`                                                 | 304s instead of repeated payloads                      |

Redis is not primary storage: it holds sessions, limits and fan-out only. Losing it must
degrade the app, never lose a record.

## Security

Findings are verified gaps, not a checklist of possibilities.

| Finding                                              | Fix                                                                                                          | Notes                                                           |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------- |
| Session cookie lacks `Secure` (`auth/session.rs:52`) | Add `Secure` outside local development                                                                       | Keep `HttpOnly`, `SameSite=Strict`, `Path=/api/crm`             |
| No security headers                                  | `tower-http` `SetResponseHeaderLayer`: CSP, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, HSTS | Also `headers` in both Next.js configs; nonces for the Next CSP |
| No request body limit or timeout                     | `RequestBodyLimitLayer` (2 MB JSON, 25 MB media) and `TimeoutLayer`                                          | Protects the pool from slow or huge requests                    |
| Login throttling stored in Postgres rows             | Move to Redis                                                                                                | Works across replicas; keep the table as the audit trail        |
| No second factor                                     | WebAuthn (`webauthn-rs`), TOTP fallback; Admin-enforceable                                                   | Staff accounts hold client data                                 |
| Secrets live only in `.env`                          | Secrets manager (AWS Secrets Manager, Infisical or Doppler) and KMS for `CRM_MESSAGING_KEY` rotation         | Never in the repository, never in logs                          |
| Dependency and supply-chain risk                     | `cargo-deny` (already configured in `deny.toml`) in CI, `npm audit`, Dependabot, SBOM                        | Fails the build on new advisories                               |
| Database least privilege                             | Restricted role per module (the website role is already planned), no application superuser                   | Migrations keep a separate role                                 |
| Backups unproven                                     | Managed Postgres with point-in-time recovery, encryption at rest, restore drills                             | Drills are the part that matters                                |
| Media uploads                                        | Antivirus scan, EXIF strip, content-type sniffing protection, short-lived signed URLs                        | Never serve private originals publicly                          |
| Public surfaces                                      | WAF and bot protection on `/api/public/...`; public routes stay cookie-free                                  | Boundary rule 10 already requires separate prefixes             |

Already done well and worth preserving: Argon2 password hashing, Origin and CSRF checks,
per-request live membership checks, transactional redacted activity, immutable account and
agreement evidence tables, and `SameSite=Strict` session cookies.

## Responsiveness

- Route-level lazy loading and intent prefetch through React Router.
- Virtualise long tables with TanStack Virtual; keep full collections in the model.
- Filter and search input through `useDeferredValue` and `startTransition` for React 18.
- Skeletons and optimistic updates instead of full-screen spinners.
- Images lazy-loaded with `srcset`, AVIF/WebP and fixed aspect boxes to avoid layout shift.
- Preload fonts with `font-display: swap`.
- Keep the existing focused workspace contexts; add memoisation only where profiling proves it.
- Optional offline shell with Workbox once the connected app is hosted.

## Observability and operations

- OpenTelemetry with `tracing` in the API instead of `eprintln` logging; Sentry in the SPA.
- Metrics: request rate, p95, pool saturation, advisory lock waits, 5xx and 429 rates.
- k6 load test in CI against the disposable database from `compose.test.yaml`.
- Two or three stateless API replicas behind a load balancer; one migration owner; health checks.

## Rollout

| Phase | Work                                                                                  | Effort    | Payoff                                                |
| ----- | ------------------------------------------------------------------------------------- | --------- | ----------------------------------------------------- |
| Now   | Compression, pagination, security headers, `Secure` cookie, body limits and timeouts  | 2-4 days  | Largest speed gain and closes real gaps               |
| Next  | TanStack Query, Redis for sessions and limits, PITR backups, Sentry and OpenTelemetry | 1-2 weeks | About 5x perceived speed; production-ready operations |
| Then  | Object storage and CDN for media, PgBouncer, activity partitioning, worker offload    | 2-4 weeks | Reaches 20,000 accounts with headroom                 |
| Later | WebAuthn second factor, WAF, virtualised tables, realtime chat fan-out, search engine | As needed | Hardening and polish                                  |

Each phase keeps the standard checks: `npm test`, `npm run build`, `npm run test:api`,
`npm run test:server:e2e`, `npm run check:lines`, `npm run check:boundaries`, plus
`cargo fmt` and Clippy in `services/crm-api`.

## Deliberately deferred

- **Microservices.** The modular monolith handles 20,000 accounts on one Postgres; the
  extraction signals and order remain in [service boundaries](service-boundaries.md).
- **Redis as a data store or cache of record data.** Sessions, limits and fan-out only.
- **A search engine, GraphQL layer or CDN-side caching of private responses** until a
  measurement asks for one.
- **Sharding or per-company databases.** One database with `workspace_id` on every row is
  the design that keeps later splits cheap.
