# Main Next.js marketplace design adoption — 5 November 2026

The owner selected the navy/white/gold Blaqks One marketplace as the general website,
replacing the earlier green general-site presentation. The implementation stays in
`apps/website` with Next.js 16, React 19 and TypeScript. The standalone source
reconstruction on `website/marketplace-source-rebuild` is a reference, not the active runtime.

## What changed

- Platform-only Home, header, expandable left-side search and footer components; navy/gold
  visual tokens apply across existing general-site property, directory and detail routes.
- Three featured listings, benefits, editorial panel, opportunity sections, neighbourhoods,
  professional workspace introduction and one compact featured-agent strip last before footer.
- General agent directory uses five records per page. The Next server adapts the existing
  twelve-item API pages, fetching a second public page only across a boundary; no backend
  response or private API contract changed. Company directories keep their existing pagination.
- `/deals` and `/professionals` are general-site routes; company hosts reject them.
- `WEBSITE_CRM_URL` configures the real professional app entry; only HTTPS or loopback HTTP
  without credentials/query/hash is accepted. Signup continues to the CRM's actual hash route.
  When no CRM URL is configured, visitors receive the professional-access page.
- Existing public catalogue projection, scoped host resolution, fail-closed API handling,
  enquiry routing, social links, CMS hero overrides and company themes remain.

## Truthful limits

The current public listing contract does not publish deal type, price-history/reference
figures or listing-status fields. Deal sections intentionally show no verified listings;
no sample discounts, distressed sellers or stale records are invented in API mode.
An explicit public-field/backend change is needed before the original preview's three
sample distress cards can become live deals.

This packet does not port the standalone prototype's browser-local saved/recent/comparison
or simulated social/account flows into the connected application. It keeps real CRM entry
and the existing live enquiry workflow. Those prototype extras need separate scoped work.
It does not deploy the app, activate domains, merge the GitHub main branch or change a
company website's template. Exact screenshot parity with the inaccessible original source
is not claimed.

## Verification

Website model/decoder/API tests, typecheck and production build pass; the expanded directory
checks cover boundary continuity, no duplicates, clamping and failed/changed upstream data.
CRM regression: 578 tests and production build pass. Formatting and the size baseline pass;
36 pre-existing oversized repository files remain. No private database was touched.

Managed Next preview could not start because the preview service adds Vite-only CLI flags.
Visual review used separate ReactDOMServer fixtures of the actual components and styles,
with synthetic catalogue data. Platform home, agents, property results and all four company
home themes showed no horizontal overflow at 375px content width. This is component/layout
verification, not hydrated Next navigation, live enquiry delivery or browser end-to-end proof.
Full connected website checks remain for CI/deployment infrastructure.
