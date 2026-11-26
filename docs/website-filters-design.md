# Complete property filters and website design review

Date: **2026-10-28**. Status: **implemented in the interactive design prototype**, with fictional inventory. Production Next.js/catalogue work remains separate.

The owner requested emirate filters on the homepages and results, budget ranges, other missing property filters and a review of the complete website design. Changes apply to the general website and all four company themes.

## Search structure

The homepage shows purpose, Emirate, Community/area, Property type and minimum/maximum AED budget. The price basis is explicit: sale price, annual rent or nightly rate. More filters opens grouped controls; Search and Clear actions are also available at the end of the expanded form. General-site search now sits in document flow with a small desktop overlap, rather than relying on fixed offsets. Mobile search remains below the hero and grows naturally when expanded.

Results retain applied filters in the URL and display readable removable chips, result counts, integer pagination and purpose-aware sorting. On phones/tablets, filters open inline, retain entered drafts when collapsed and close with Escape, returning focus to the opener. Apply and Reset remain in normal flow so they cannot cover fields or validation messages.

| Filter                  | Behavior                                                                                                                                        |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Purpose                 | Buy, Rent, Holiday homes; results can browse all purposes without a price comparison                                                            |
| Emirate                 | All seven UAE emirates; no-inventory emirates remain selectable with honest empty results                                                       |
| Community/area          | Cascades from Emirate and the company's current sample inventory; incompatible area selections clear when Emirate changes                       |
| Property type/category  | Residential/commercial categories and ten property types; category narrows types and disables residential bedroom criteria for commercial stock |
| Budget range            | Independent inclusive minimum/maximum AED values; sale/annual/nightly basis; changing purpose clears old budget values                          |
| Bedrooms                | Studio, 1–4 and 5+; Studio remains distinct from commercial space                                                                               |
| Bathrooms               | Minimum 1–4                                                                                                                                     |
| Size                    | Inclusive minimum/maximum sqft                                                                                                                  |
| Furnishing              | Furnished, Unfurnished, Part-furnished                                                                                                          |
| Parking                 | Minimum spaces; amenity and space metadata agree                                                                                                |
| Amenities               | Multiple selections, all required: balcony, pool, gym, parking, private garden, maid's room                                                     |
| Listing details         | Ready/off-plan and primary sale/resale remain separate fields                                                                                   |
| Developer/company/agent | Developer references, company on the general site only, and agents scoped to the current company site                                           |
| Holiday stay            | Guest capacity and stay length against minimum-stay facts; these are not live booking/date availability                                         |
| Sort                    | Newest from explicit synthetic dates, title, size ascending/descending; price ascending/descending only for a selected purpose                  |

Unknown enums, invalid community/emirate combinations, negative/nonfinite numeric values and reversed ranges never broaden results. The form preserves values after validation, provides a summary and field hints and focuses the first invalid control. Legacy `budget` URLs still act as a maximum budget, subject to the purpose rule. Chosen sort survives Apply; moving to All purposes clears a price sort to Newest. Changing filters resets pagination, and non-integer page values are floored/clamped.

## Design and behavior corrections

- Fixed general homepage hero/search offsets that would overlap the expanded form; checked all four company themes and narrow widths.
- Corrected company filter-sidebar headings inheriting oversized editorial type, and equalized input heights when a range error hint wraps.
- Replaced raw filter IDs with names and readable AED/sqft/basis labels. Added active-page semantics to pagination.
- Replaced array-order “Recently added” with explicit synthetic publication dates and actual sorting.
- Corrected Studio/Office labels and singular bed/bath/night text. Holiday samples are ready residential properties, with explicit capacity/minimum-stay facts; amenity and furnishing details match the filter data.
- Added enquiry/contact shortcuts near property facts on mobile, while preserving named listing-agent WhatsApp/email ownership.
- Rejected invalid or mismatched listing/company/agent enquiry IDs instead of falling through to another recipient. Agent-profile enquiries now identify that agent and owning company.
- Made the enquiry privacy link an inline link. Added company-scoped area empty-state recovery and prevented unrelated areas from filling company directories.
- Added Escape/focus return for menu/filter disclosures, heading focus after route changes and preview-toolbar height accounting so footer content stays reachable.
- Raised dark-theme validation contrast through a semantic error colour. Sampled error summary and field hints measure **8.73:1** against their surface.

A read-only product design review inspected source and representative general/company desktop/mobile screens, including enquiry/editor and light/dark results. Its concrete findings were addressed. This is not a full WCAG audit or a production security review.

## Review and verification

Build with `node design/website/build.mjs`. `dist/filters-preview.html` opens an applied filter example; `review.html` and `company-preview.html` show the updated homepage searches. The complete screen index now contains **70** page/state examples. With the loopback preview server running, `node design/website/export-company-review.mjs` refreshes the **34-page** desktop/mobile company visual gallery, including emirate/budget, feature and validation examples.

Local verification:

- **70** page/state examples at 1440px/390px, 40 theme routes, 42 contact combinations, 160 company combinations, 80 developer profile/site combinations and 48 developer responsive combinations pass without browser exceptions or horizontal page overflow.
- **50 additional search/filter combinations** cover general site/four company themes at 1440px, 1280px, 768px, 390px and 320px, with expanded controls and applied-filter results. Cascading geography, budget errors/value retention, multiple amenities, Studio, holiday fields, sorting retention, mobile Escape/draft and enquiry ownership checks pass.
- Seven focused model checks cover range boundaries/invalid values, all seven emirates, company scope, rooms/features, coherent holiday data, sorting and enquiry-recipient resolution. Advanced Search/Clear dependency reset, compact company heading and equal error-row input heights were checked separately.
- Existing CRM frontend tests **471/471** and production build pass. Formatting, prototype file sizes, whitespace and repository shrink-only size baseline pass. The strict repository audit retains its **37 existing oversized files**.

No CRM API/database, live booking, payment/provider delivery, production publication or hosted deployment was added. Real filters will operate on approved public snapshots and catalogue metadata through the WEB implementation; they must not query private CRM records or treat fictional developer associations as real listings. No push was performed.
