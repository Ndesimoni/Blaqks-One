# Community maps on property pages

Owner approved on 2026-10-28 for the general Blaqks One website and company websites. This packet updates the isolated `design/website` prototype, not the production CRM or planned Next.js application.

## Public location contract

The property page's **Location & neighbourhood** section displays the community and emirate with this notice: **“Approximate location. Exact address available from the listing agent.”** The map uses shared community-level bounds, never a property's coordinates, building/unit number, access instructions or private CRM map link. It has no property marker and does not request the visitor's location. A community map is not a verified boundary survey.

The three sample areas are Dubai Marina, Dubai Hills Estate and Saadiyat Island. Their map extents are illustrative community views; future public catalogue metadata needs approved, reviewed area geometry. Unknown areas must keep readable location text and agent contact without guessing coordinates.

The map loads from OpenStreetMap only near the location section, reserving its space to prevent layout jumps. An explicit load/retry action and an external community map link provide alternatives. Provider availability cannot be inferred solely from an iframe load event; readable text, privacy notice and enquiry link remain available independently. OpenStreetMap supplies the embedded map and attribution; loading it makes a third-party network request. No API key, tracking script, additional map package or exact-property directions are added.

**Ask agent for exact location** opens the existing listing-specific enquiry, retaining company/theme scope. It does not reveal the address, send a message or create a CRM lead in the prototype.

## Review

Run `node design/website/build.mjs` and open `design/website/dist/maps-preview.html` for a direct property example. Company property pages share this section. Static screenshot galleries cannot supply an interactive live map.

The self-contained HTML keeps its text, imagery, contact and navigation offline; live map tiles require internet access. This execution environment blocks the OpenStreetMap connection with CONNECT 403. Focused browser checks therefore distinguish mocked embed loading, blocked-provider recovery and actual external map availability. Live cartography and current area coverage are not verified here.

## Verification completed

- `node --test design/website/check-location-model.mjs`: 3 checks pass for community-only map parameters, unknown areas and private-field independence.
- `PLAYWRIGHT_BROWSERS_PATH=/workspace/.playwright node design/website/check-property-location.mjs`: 20 responsive combinations (1280/768/390/320, general plus four company themes), deferred loading, manual keyboard loading/focus, reload, provider-failure fallback, scoped enquiry and company-unavailable route pass. Readable text/button contrast checks pass across all five visual variants. Embed responses are mocked; error recovery also dispatches an iframe error because real cross-origin failures may emit only `load`.
- All 471 existing tests and the production build pass. The build retains its existing chunk-size warning.
- All 87 prototype code/configuration files meet the 150-line rule; formatting, diff whitespace and the shrink-only baseline pass. The strict repository audit still reports the same 37 existing oversized files.

Generated interactive exports and the 34-page company screenshot gallery are refreshed. No commit, push or hosted CI run was performed.
