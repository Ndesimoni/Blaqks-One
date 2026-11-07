# Second website: single-company architectural design

Status: local Next.js design review, 6 November 2026 (Dubai). Not committed, pushed or deployed.

The owner selected Pinterest reference `https://www.pinterest.com/pin/875176140100435508/`
and supplied a screenshot. The short link could not be retrieved by search; the supplied
screenshot establishes the visual direction. The later instruction is to use the main
website's **page structure**, with this reference's **design**, adapted for a single company.

## Scope

Company theme 1 now uses a white/charcoal architectural composition: sans-serif typography,
large editorial headings, wide photography, fine rules, square controls and restrained hover
movement. The first marketplace website and company themes 2–4 are preserved. This is native
React/TypeScript in the existing Next.js app, with no original-view-engine dependency for
the new company components.

Included: home, purpose/community/price search, full property filters/results/empty states,
listing galleries/details/features/floor plans/community maps, listing-advisor contact,
related properties, company About/Services, team/search/five-person pagination, advisor
profile and assigned properties, compact team recommendations, Contact/FAQ, enquiry and
existing community/developer/legal routes. Multiple-company discovery is not promoted in
the navigation. All content remains scoped to the resolved company host.

`harbour.localhost:3000` shows the new design with the existing fictional Harbour & Palm
company. The company name is a sample, not an assumption about final branding. Sample
inventory retains its IDs, ownership, asking prices and price periods. The new architecture
photos are applied only in the explicitly local company-theme-1 sample adapter. Live
listing images continue to come from public catalogue responses. Advisor photo fields are
not supported by the current public contract, so the design reserves portrait space rather
than inventing staff photographs.

## Components and behavior

- `src/components/company/` owns the new company composition and page components.
- `src/lib/company-design.ts` gates the composition and supplies the sample image adapter.
- `src/styles/atelier-*.css` is scoped to company theme 1 and imported after old theme styles.
- Existing public projection, host validation, contact links, gallery, advanced filters and
  enquiry intake are reused. API failures never fall back to sample records.
- `/services` is served only for this company design and binds published services copy when
  supplied. No private CRM API or backend schema is changed.
- Team pagination uses the existing five-item public-directory adapter; other company
  themes keep their original pagination.
- Sample Contact has a labelled, browser-only form that neither transmits nor persists
  details. Live Contact uses the existing company-targeted enquiry form/endpoint. Missing
  office details, final legal content and unpublished floor plans remain stated as missing.

## Review and verification

40 focused model/design checks and one synthetic public API consumer pass. Typecheck and
production webpack build pass. The size baseline has no new/growing oversized files;
36 pre-existing repository violations remain. Browser review uses a separate copy of the
production build, with a fixture-only hostname mapping to the recognised sample company.
That wrapper is outside the repository and is never part of production host resolution.

Verified in the browser: native Next navigation, rental-purpose budget wording, company
community search through to its matching result, property page, gallery opening and Escape
focus return, advisor page and its own-company property collection. The Contact preview form was also exercised with fictional details; it clearly confirmed
that no message was sent or data saved. All nine homepage images loaded, and the desktop
page has no horizontal overflow. The final hero/card aspect ratios were visually reviewed. This does not certify live CRM delivery,
provider messaging, complete accessibility or all mobile layouts.

The owner explicitly requested viewing the design before GitHub push. Keep all changes
local until the owner approves the design/push.

## Illustrative asset provenance

All sample photography is now licensed Unsplash photography (Unsplash licence), saved under
`public/company`:

- `hero-dusk.jpg` (2560 × 1440, ~580 KB): `photo-1600585154340-be6161a56a0c`, the
  two-storey contemporary house at dusk. Theme 1 and theme 2 sample heroes and the theme 2
  contact background.
- `pavilion.jpg`: `photo-1613490493576-7fde63acd811`; `garden-house.jpg`:
  `photo-1580587771525-78b9dba3b914` (sample listing cards).
- `residence.jpg`: `photo-1600596542815-ffad4c1539a9`; `courtyard.jpg`:
  `photo-1600607687920-4e2a09cf159d`; `interior.jpg`: `photo-1600210492486-724fe5c67fb0`;
  `terrace.jpg`: `photo-1600566753086-00f18fb6b3ea`.

The earlier unlicensed images (architect Zoran Bodrožić's project photograph `hero.jpg` and
the cropped design-reference screenshot `reference-composition.png`) were removed from the
site and the repository on 7 November 2026, together with the duplicate low-resolution
`villa.jpg`. These are illustrations, not a claim that the example company represents
those properties. Final company publication should use its selected, approved property and branding assets.

## Owner correction: match the supplied composition

The owner rejected the first monochrome interpretation and requested the supplied design
one-to-one, with additions only. The revised preview replaces that earlier hero arrangement
with the reference's overlapping headline/Book-a-call placement, full-width house-and-car
image, compact header, narrower content column, four-tab filter strip, New properties
heading and tighter unboxed three-column cards. The services title now follows the reference.

A clearer image of the same reference was located at
`https://cdn.dribbble.com/userupload/45867978/file/still-c5e25acb0e6a1805ec2951c79609a012.png`.
It was used only as a visual reference: the sample hero now shows the licensed
`hero-dusk.jpg` photograph (see provenance above) as a full-bleed `object-fit: cover` image
in the same composition; headline, navigation, button and all filters remain real HTML
controls. Listing pictures, company name, UAE currency/units and the
additional pages remain sample adaptations; exact parity for every asset is not certified.

The updated four-tab search correctly maps Buy/Rent, new developments to `ready=off-plan`,
and commercial properties to the existing public query fields. Browser verification reached
`/properties?purpose=buy&ready=off-plan...` and its matching company-scoped result. The 40
website checks plus one API consumer, typecheck, production webpack build and file-size
baseline pass. No commit, GitHub push or deployment occurred. The browser review screenshots
are the revised proof, superseding the earlier standalone-photo hero preview.

## Product polish requested after the reference revision

The owner accepted the general direction and requested senior product-design adjustments
and useful additions. The reference hero/composition remains intact. Changes:

- Active navigation with `aria-current`, 44px search/CTA targets, clearer type and price facts,
  balanced card headings, phone-friendly form font sizes and reduced-motion handling.
- More options now submits the selected filters instead of discarding them.
- A compact four-question homepage FAQ explains viewings, search, price periods and company
  contact; its aside links to the company enquiry journey.
- A mobile property enquiry bar preserves the current listing target and clearly identifies
  annual rent, nightly rate or sale asking price. Body padding keeps footer content reachable.
- Published hero photos use a non-overlapping layout so arbitrary catalogue images do not
  undermine text contrast. Sample-reference artwork is unchanged.
- Advisor placeholders retain initials without unfinished implementation labels.

The additions use existing company/public relationships and enquiry intake. No booking,
account, messaging-provider or private-record functionality is implied. Tests/typecheck,
production webpack build and file-size baseline pass. Mobile device browser acceptance is
still required; no responsive emulation API is available in this browser session.

Polish browser review completed: More options retained Rent, Dubai Hills Estate and the
AED 200,000 annual budget through to the matching result; Properties received the active
navigation marker. The new native FAQ opened and closed correctly. The polished full-page
and FAQ screenshots supersede earlier review captures. GitHub push remains on hold.

## Hero filter placement

At the owner's request the existing search form now overlays the lower portion of the
hero photograph in a white panel. It is rendered once inside CompanyHero, with the
headline and upper architecture unobstructed. The introductory section below the hero
keeps its copy but no longer duplicates the form. Mobile uses a flow layout just below
the photo; published sites without a hero image also retain a readable flow layout.
Typecheck, production build and the file-size baseline pass. Browser placement review
confirmed the panel is on the photograph. No push/deployment occurred.

## Hero readability refinement

The owner requested a dark gradient for the top copy. A non-interactive gradient layer now
sits above the photo and below the headline, larger supporting copy and white CTA. It fades
before the lower image; the search panel keeps its own white surface above the overlay.
The header and inner pages retain their light treatment. Browser review confirmed the new
hero and the About page. Scoped CSS preparation, formatting and size baseline pass. All
pages are working previews with sample company content; no GitHub push occurred.

## Navbar colour and legibility

The navbar now uses a full-width charcoal surface matched to the hero gradient, with
14px high-contrast navigation links, a white wordmark, a white primary contact action,
clear focus outlines and a stronger active-section underline. Mobile menu backgrounds
and link colours are paired explicitly to avoid white-on-white dropdown text. The footer
and other company themes remain unchanged. Browser review confirmed all four desktop
navigation labels are visible. Typecheck, production build and size baseline pass.
No commit/push/deployment occurred.

## Inner pages follow the main Blaqks One flow; homepage frozen

The owner clarified that the approved company homepage and colours must stay as they are.
This packet changes inner pages only. Checksums of CompanyHome, CompanyHero and the hero
search/contrast/navbar styles were recorded before edits and remain unchanged afterward.

Property discovery now follows the main site's hierarchy: breadcrumb/introduction →
collapsible filter sidebar beside a search/sort toolbar and three-column results → retained
filters, count, empty/error states and pagination. The existing public filter contract is
preserved. SearchForm's optional sidebar mode defaults off, so other websites keep their
existing form composition.

The property page now groups floor plans/tours separately, keeps the listing representative
beside details and adds the main site's explicit listing-advisor section before related
properties. Request a viewing, floor-plan requests and tour questions go to the selected
listing's enquiry page. That page keeps its property image/title/reference/price and advisor
beside the form. Sample enquiries simulate confirmation without sending/saving; live forms
retain the existing public endpoint and target ownership checks. Team/profile flows retain
the main site's directory → profile → assigned listings → other company advisors sequence.

Browser verification: searched Island → filtered Buy without losing the search term →
opened Island Retreat → requested a viewing → confirmed listing SAMPLE-2 and Adam Cole →
submitted fictional preview details → saw the explicit no-message/no-save confirmation.
A duplicate hidden search key found during review was removed. Typecheck, 40 model checks,
one public API consumer and the production build pass. The file-size baseline has no new
violations. Source remains local pending design approval; no GitHub push or deployment.

### Shared navigation and readability review — 6 November 2026

The company header now includes Contact alongside Properties, Company, Services and Our people. Desktop and mobile links expose the current section. The final clarity layer uses neutral charcoal colours, stronger field borders, clearer labels and consistent panel surfaces while preserving the approved homepage composition.

Rendered review covered 15 routes: home, catalogue, listing, team, advisor, company, services, contact, listing enquiry, areas, area profile, developers, developer profile, privacy and terms. Every route displayed the shared header and footer without horizontal overflow at the review viewport; linked primary sections highlighted correctly. Production build, TypeScript, website tests and file-size baseline checks passed. Mobile device visual acceptance remains separate. Changes remain local pending design review; no GitHub push performed.

The owner approved the GitHub source handoff on 6 November 2026, after reviewing both company designs. The earlier push hold is lifted. The source branch is `website/single-company-atelier`; production deployment and merging remain separate.

## Company websites polish — 7 November 2026

Applied across all four company themes after a design review, keeping each theme's palette:

- Phone layouts: mobile overrides for themes 1 and 2 used `:where()` and lost to desktop
  rules, so headers never collapsed and sections stayed in columns. They now use `:is()`;
  every company route is exactly 390px wide at 390px, with only the wordmark and Menu.
- Licensed hero photograph (above), blended into the charcoal header; on phones the photo
  is taller and the search card straddles the hero. Hero selects are 44px on phones and one
  column at 420px and below.
- Copy and data: "1 bath"/"2 beds" plurals, "sq ft" everywhere, readable furnishing and
  amenity labels, "No parking" instead of 0, no "Page 1 of 1", developer listing counts only
  when non-zero, developers with listings on the site first. Cards name the developer
  ("Developer: Emaar (illustrative)") and the listing agent ("Listed by Maya Reed").
- Type floor of 11px for taglines, eyebrows, captions and card facts.
- Footer: Developers link for themes 1 and 2; theme 2's footer uses its own house-icon brand.
- Themes 3 and 4: spacing fixes in the hero heading and image, current-page navigation,
  developer tiles, a Contact enquiry form (sample preview or live company enquiry), a gold
  primary hero action and a deeper scrim on theme 4, uppercase eyebrows, a COMPANY footer
  column, a soft card hover and an aligned phone menu.
- Cedar's sample listings have their own names instead of reusing Harbour's.
