# Company website visual refinement

Date: **2026-10-28**. Status: **clickable design prototype**, separate from production Next.js delivery.

The owner requested premium, stylish, classic and professional company websites. This refines the existing four company themes. Agents remain public profiles inside company/general websites; it creates no standalone agent websites.

## Review

Run `node design/website/build.mjs` to generate `design/website/dist/company-preview.html`. This self-contained export opens on the fictional Harbour & Palm company homepage. Its preview toolbar includes a **Company theme** selector, which retains the current page and filters. **All screens** opens the complete design directory. The existing `review.html` export still opens the general prototype.

For a local server, run `node design/website/serve.mjs` and open `http://127.0.0.1:4178/#/home?site=harbour&theme=1` on that same machine.

For a full-page visual review, run `node design/website/export-company-review.mjs` with that server running. Its self-contained `dist/company-all-pages.html` contains 34 page/state examples in desktop and mobile sizes, with a page selector and Previous/Next navigation. These are full-length screenshots of the existing prototype: four home compositions, property results/purposes/details, team/profile, About/Contact, enquiry/confirmation, areas, legal placeholders and empty/error/unavailable examples. It is separate from the interactive website export.

## Visual direction

| Theme     | Composition                                                                                     |
| --------- | ----------------------------------------------------------------------------------------------- |
| Signature | Framed architectural photograph, classic serif headline and light search panel                  |
| Modern    | Light split composition with text and photograph side by side                                   |
| Editorial | Oversized serif headline, asymmetric image and quiet editorial spacing                          |
| Nocturne  | Deep green surfaces, restrained gold controls and a photograph fading into the headline surface |

All themes share the same navigation, search, inventory, contact actions and enquiry journey. Each company uses its own monogram/name, location descriptor and active navigation. Blaqks One attribution is placed in the footer. The general website retains its existing design.

Company home sequence: architectural hero → search → selected sale properties → editorial introduction → actual inventory locations → named team → company enquiry close. The locations and counts come from that company's fictional public inventory, including search options; another company's stock is never used to fill a section.

The visual system continues into property results/details, team and agent profiles, About, Contact, enquiry and legal pages. Property cards use larger photography, serif titles and fine rules. WhatsApp and Email buttons retain the property's listing agent and property context. Company About uses a large image, editorial story and three explanatory steps. Company Contact distinguishes the company Admin enquiry destination from named agents' direct contacts.

## Mobile and performance

- Search remains in document flow on phones, without fixed hero/search offsets. Split/editorial heroes stack; photographic/dark heroes preserve readable image overlays.
- Area and story photographs have explicit responsive aspect ratios. Property facts and contact buttons remain readable without horizontal page scrolling.
- The company header has a native mobile menu, active-page indication and 44px navigation targets. Theme selection is a review-only control.
- Existing three local sample JPEGs, native fonts and browser layout/CSS are reused. No new dependency, remote font, autoplay video or WebGL scene is introduced. The standalone export is approximately 749KB, including sample images; this is not a measured production performance budget.
- Reduced-motion preferences continue to disable nonessential movement. Full interactive 3D remains deferred.

## Content and implementation limits

Companies, agents and inventory are fictional. Sample images are illustrative, including the image on Contact, which is not claimed to be an actual office. The preview invents no trading history, awards, client reviews, transaction counts or verified credentials. Missing office addresses/hours are stated as missing.

Contact links use reserved fictional numbers and `.example` addresses, and open external applications without sending automatically. Forms and settings still simulate their outcomes. Approved real content, public contact versions, CRM lead intake, persistent website settings, domains and Next.js rendering remain future WEB implementation work.

## Verification

The prototype browser checks include all existing page/state routes and contact checks. Additional company checks cover all three sample companies across four themes and 1440px, 768px, 390px and 320px widths, plus company property/team/profile/About/Contact/enquiry routes. They check inventory-derived locations, company scope, mobile search layout, image proportions, theme switching with filters retained, listing-agent contact and company enquiry destinations. Representative rendered desktop/mobile views are inspected separately; automated checks do not establish full accessibility certification.

Completed locally: 57 existing page/state examples, 40 existing theme-route checks, 42 contact combinations and **160 additional company combinations** pass without browser exceptions or horizontal page overflow. The final company pass was repeated with explicit rendered-page/theme assertions. A read-only product design review inspected the four themes and light/dark desktop/mobile About/Contact views; its image-proportion and internal-routing-copy findings were corrected. Existing frontend tests **471/471**, production build, Prettier, prototype file sizes and repository shrink-only size baseline pass. The strict repository size audit retains 37 existing oversized files; no new oversized file was added. No GitHub push or deployment was performed for this refinement.

The developer follow-up adds a homepage section, directory, profiles and property filters to both websites. See [developer discovery](website-developers-design.md) for the 40-name reference catalogue, illustrative-association labels, company scope and updated verification.

The filter follow-up adds all-seven-emirate discovery, min/max budget and advanced controls, with the broader visual/interaction corrections documented in [website filters](website-filters-design.md). The company visual review now includes 34 examples.
