# Blaqks One public websites

Native **Next.js 16 / React 19 / TypeScript** application for the general Blaqks One website and company websites. This is separate from the React/Vite CRM and Rust backend. There are no standalone individual-agent websites.

## Run locally

Use Node 24, or Node 22.18 or newer. From the repository root:

```bash
cd apps/website
npm ci
cp .env.example .env.local
npm run dev
```

The copied example explicitly selects local sample mode. Open:

- General website: <http://localhost:3000>
- Company Signature: <http://harbour.localhost:3000>
- Company Modern: <http://harbour-modern.localhost:3000>
- Company Editorial: <http://harbour-editorial.localhost:3000>
- Company Nocturne: <http://harbour-nocturne.localhost:3000>
- Other fictional companies: <http://cedar.localhost:3000>, <http://dune.localhost:3000>

These URLs refer to the machine running the command. This cloud workspace is separate from your VS Code checkout; transfer or pull these files first before running locally. The source `apps/website` directory is the website, while `design/website` remains the older design prototype.

## Included now

- Server-rendered homepages, search/results and property detail pages with real path URLs.
- All seven emirates, cascading communities, budgets and advanced property filters; sorting and pagination retain query state.
- Company/agent/developer/community directories and profiles, with host-scoped public counts.
- Public listing-agent WhatsApp/email links, photo gallery, private-address-safe community maps.
- Four company compositions, responsive navigation, keyboard menu/gallery, About/Contact, placeholder legal pages and connected enquiry forms for public listings/agents/companies.
- Server-only public API adapter, explicit public-field projection, unknown-host/foreign-record rejection and failure recovery. No CRM API/session import.

The Rust website backend now implements site/profile configuration, private drafts/direct publishing, selected listing revisions/public media, host-scoped catalogue and targeted enquiries saved as CRM leads. The supported hero/About/Services/Contact copy and search metadata bind to published CMS content. Company/platform content controls now live in the connected CRM; see [content settings](../../docs/website-content-settings.md). See [backend guide](../../docs/website-backend.md) for exact functionality and limits. This is a local foundation, not a launched website: public profile/listing/enquiry management screens, richer content blocks, uploads/logo editing, canonical domains, sitemaps, production image delivery, final legal copy, full accessibility/performance validation and launch CSP remain work. Robots deliberately disallow indexing. Generic platform contact without a selected company, property or representative is disabled pending the recipient decision.

## Connect the website backend

Use [`docs/website-api-contract.md`](../../docs/website-api-contract.md), which defines the implemented read/intake contract, public shapes, hostname binding, filters and private publishing controls. The owner subsequently authorised backend implementation in `services/crm-api`; [setup and isolated test commands](../../docs/website-backend.md#running-and-verifying) describe that work. This does not apply migrations to an existing development database automatically.

Set server environment variables:

```dotenv
WEBSITE_DATA_MODE=api
WEBSITE_API_ORIGIN=https://your-public-api.example
```

`api` is the default when no mode is set. API failures never fall back to sample content. Sample mode recognises only the explicit local hosts above and labels fictional content/contacts. Production API responses use HTTPS except loopback development; requests omit credentials, refuse redirects and use no-store. Public API failures show unavailable content, never expose error internals to visitors. Configure the exact platform/company host through the authenticated backend controls; unknown hosts fail closed. Public media URLs rebase to this fixed API origin, so it must also be reachable from visitors' browsers. Local loopback is for local development, not remote visitors.

## Checks

```bash
npm test
npm run typecheck
npm run build
```

`npm test` includes model/decoder checks and a public API consumer against an isolated synthetic HTTP fixture. For the real Rust API + disposable PostgreSQL/storage + production Next.js browser flow, build this app and run from the root:

```bash
API_TEST_FILES=tests/api/website-next.test.mjs npm run test:api
```

That optional integration creates synthetic data and never uses a real company database. For production-rendered browser checks, build and run `WEBSITE_DATA_MODE=sample npm start` in one terminal. From the repository root, with its existing Playwright tooling installed:

```bash
WEBSITE_TEST_ORIGIN=http://localhost:3000 node apps/website/tests/check-browser.mjs
```

Set `PLAYWRIGHT_BROWSERS_PATH` if the browser is stored in a non-default location. Screenshots and `browser-report.json` are generated review artifacts, excluded from Git. Live maps require OpenStreetMap connectivity; this cloud environment blocks that provider, so automated checks exercise the readable fallback rather than certify live tiles. GitHub's Website workflow builds/tests this app; Website connected adds the production Next.js/disposable backend integration. The default CRM API set includes the four website backend suites. Workflow files do not establish a hosted run result.

Frontend baseline verification (2026-10-28, before backend binding): 12 model/shape checks plus one synthetic API-consumer integration, type generation/typecheck and production build passed. The sample-mode production browser check passed 68 page/layout combinations, search/validation, public contact ownership, foreign-company/unknown-host 404, keyboard menu and JavaScript-disabled SSR. Gallery Escape/focus and sampled text contrast across themes were reviewed; this is not complete WCAG certification. Backend integration adds focused suites and a real API browser flow; consult the latest [handoff](../../docs/handoff.md) for completed results rather than treating that earlier baseline as connected verification. No hosting or live client-data testing has occurred.
