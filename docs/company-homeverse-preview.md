# Third website — navy and gold company theme

Owner brief, 6 November 2026: Pinterest https://pin.it/5n9nWFhtk, canonical pin visible in the supplied screenshot https://www.pinterest.com/pin/867998528223539024/. Build this homepage composition; keep the main Blaqks One page flow for the rest. Show the design before a GitHub push. This is the third overall website and second individual-company design.

## Implementation

Company theme 2 now uses a dedicated navy/gold header and homepage: photo hero with serif heading, gold actions, overlapping purpose/location/type/AED-budget/bedroom search, four featured property cards, four service benefits, photo/company introduction, enquiry panel and footer. Existing company name and approved public data stay bound to the resolved host. Theme 1, platform, themes 3/4 and private CRM are retained.

The shared company page components provide the catalogue with advanced filters and sorting; property gallery, facts, floor-plan availability, location, named listing advisor, public WhatsApp/email, targeted enquiry and related properties; team directory and advisor profiles; company, services and contact; area/developer directory profiles; privacy and terms. Agent pagination follows the main site's five-person flow. The generated stylesheet reuses scoped inner-page rules for theme 2, then applies the new design tokens and overrides. No handwritten stylesheet copies are generated into source.

## Review and provenance

Sample host: `harbour-modern.localhost`. Run `WEBSITE_DATA_MODE=sample npm run dev --prefix apps/website` and open http://harbour-modern.localhost:3000 locally. Managed QA uses a disposable production-build wrapper and maps its host only inside the QA checkout. Production host validation is unchanged.

The uploaded screenshot determines composition and theme. Pinterest retrieval did not expose original design assets. The hero and listing photographs are the existing illustrative company assets, not the exact Pinterest building. No claim of pixel-perfect image parity or company track record is made. Preview data and contacts are fictional and visibly labelled. Forms in sample mode send/save nothing; API-mode forms retain the public enquiry contract. Live catalogue failures never fall back to samples.

Verification: 42 website tests and the public API consumer pass; production Next.js build and TypeScript pass. The size baseline has no new/growing violations (36 existing remain). Browser verified hero filters through one matching listing and its targeted enquiry with the correct listing reference and advisor. Fifteen rendered routes retain the new navbar/footer without horizontal overflow at the desktop review viewport. Mobile styles are supplied; physical-device visual acceptance remains outstanding. Source is local, uncommitted and not pushed/deployed.

## Homepage refinement — 6 November 2026

Added browser-local property bookmarks (company/listing-scoped keys, storage failures fall back to this visit), photo counts and explicit property actions; larger card detail text; four lifestyle links using supported public filters; a compact company-only advisor section; and a factual company/location/reference/contact strip. Advisor frames use initials because no public portrait field or real photographs were supplied. Licence badges, office opening hours, testimonials and review scores remain absent pending genuine information.

The homepage enquiry uses a compact identity row and optional phone input in both sample and API rendering. Default forms elsewhere retain their existing field layout and submission contract. Gentle one-time section entry animations respect reduced-motion preferences, and content remains visible without JavaScript. Card and lifestyle imagery retain the existing labelled illustrative assets; no exact Pinterest-image claim is made.

Checks: TypeScript, production build, 42 website tests plus the API consumer, formatting and file-size baseline pass. Browser verified saving a property survives reload, the family lifestyle link filters to villas, and the compact sample enquiry works without supplying a phone and reports no delivery/storage. No backend delivery claim, GitHub push or deployment. Mobile breakpoints are present; device visual acceptance remains outstanding.

## Source handoff authorization

The owner approved committing and pushing the completed work on 6 November 2026. The earlier review hold is lifted for this source handoff. Push the company designs together on `website/single-company-atelier`; this does not authorize merging into main or a production deployment.
