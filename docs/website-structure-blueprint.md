# Website structure blueprint

Date: **2026-10-28**. Status: proposed structure for review, not implemented screens.

**Owner correction:** improve the structure itself, rather than preserve the existing screenshot layouts and only polish them. This supersedes the earlier preserve-the-layout recommendation in the [visual refinement brief](website-visual-refinement.md). Retain the brand, the two website types, four company theme choices and established publication/enquiry rules. Reorganise navigation, page hierarchy, section order and interactions around visitor tasks.

Scope: the **Blaqks One general website** and **company websites**. Agent profiles are pages inside those sites. This blueprint adds no standalone agent websites, public booking, customer accounts, payments or unimplemented live-chat promises.

## 1. Organising principle

The visitor journey is **choose a market → narrow the search → inspect a property → understand its representative → enquire**. Company background, editorial material and CRM sales are supporting journeys. Each page has a clear purpose; avoid assembling a long homepage from every available content block.

| Page                 | Primary question                                   | Primary action                                     |
| -------------------- | -------------------------------------------------- | -------------------------------------------------- |
| General home         | Where can I find the right property?               | Search properties                                  |
| Results              | Which properties fit my needs?                     | Open a property                                    |
| Property detail      | Does this property suit me, and who handles it?    | Enquire about this listing                         |
| Area page            | What eligible inventory is available here?         | Browse the filtered listings                       |
| Company profile/site | Can this company help me, and what does it offer?  | Browse its approved properties                     |
| Agent profile        | Who represents these listings?                     | Inspect their eligible listings; permitted contact |
| Contact              | Where will my enquiry go?                          | Submit to the clearly identified destination       |
| Website settings     | What is live, what changed, and what needs action? | Continue the relevant draft/setup/review task      |

## 2. Navigation: fewer choices, clearer destinations

### Blaqks One general website

Desktop header: **Logo · Buy · Rent · Holiday homes · Explore**. Explore groups **Areas, Companies, Agents**; each has an accessible direct destination rather than a hover-only menu. A quieter business/account area contains **For professionals** and **CRM sign in**. Do not give CRM sales the same visual weight as customer property search.

Buy, Rent and Holiday homes open one shared results system with the relevant purpose selected and the correct price basis. Commercial/residential, ready/off-plan and primary/secondary are independent search filters, not a long list of competing main-navigation categories. If a campaign landing page is added later, it still resolves to the same authoritative filtered catalogue.

Footer: Browse properties; Explore areas/professionals; About Blaqks One; Contact/help; Privacy/terms; For professionals. Use short labelled groups. No unimplemented favourites, comparison, booking or account buttons in the first release.

### Company website

Desktop header: **Company logo/Home · Properties · About us · Contact**. Properties opens the company's filtered catalogue with Buy/Rent/Holiday views where inventory is eligible; About us can link to its approved team directory. Areas served and services start as homepage/About sections, with separate destinations only when the corresponding approved extra pages exist. The main CTA is **Browse properties** or the contextually appropriate enquiry action, not multiple equal buttons.

Company sites need a complete independent visitor journey: customers must not have to leave for the general site to see details or submit an enquiry. Keep brokerage identity and the responsible agent clear. Company content and inventory never fall back to a different company's records to fill an empty section.

On phones, show the brand and a labelled menu button; reveal navigation in an accessible drawer. Search controls appear in the page where needed. No crowded desktop navbar squeezed onto one line.

## 3. General homepage: six purposeful sections

```text
COMPACT GLOBAL HEADER
│
├─ 1  Architectural hero + useful search
├─ 2  Property discovery collection
├─ 3  Explore areas
├─ 4  Find a company or agent
├─ 5  How browsing and enquiries work
└─ 6  Compact footer + secondary professional entry
```

### 1 — Architectural hero and search

One headline, a concise explanation and a visually strong architectural image. Keep search in a stable, high-contrast surface within the first viewport. Starting controls: Buy/Rent/Holiday, location, property type, budget and Search. More criteria belong in results, not an oversized opening form. Use the correct budget basis for the selected purpose.

On desktop, image and content can overlap intentionally, with generous breathing room. On mobile, stack headline, compact image and search so visitors can search without scrolling through an introduction. Do not force a full-screen visual before showing controls. A hint of the next section should be visible where practical.

Depth/3D lives in decorative imagery, not the search panel or moving text. A static poster is the complete baseline. The site remains usable before any optional effect loads.

### 2 — Discover properties

One curated or recent approved collection, with a clear heading and **View all properties**. Do not repeat “Featured,” “Recommended,” “Premium” and “Latest” grids that mostly show the same inventory. Editorial selection changes placement, never approval or eligibility. Label paid placements if separately introduced.

Use a compact preview of up to six cards; View all opens results rather than extending the homepage indefinitely. Each card puts image, price/basis, location, essential facts and approved company/agent identity in a consistent order. No invented scarcity, unverified claims or random placeholder totals.

### 3 — Explore areas

A small set of photographic area tiles with short labels and real filtered destinations. Use visible eligible inventory to make these useful. Public counts, if shown, must come from the published catalogue. Full area descriptions can wait until genuinely available and approved; a location tile can initially go directly to filtered results.

### 4 — Find the right professional

One coherent section with **Companies** and **Agents** destinations and a limited approved preview. Do not scatter professional cards between property groups. Every profile lists only information deliberately approved for public display. Platform operator access to these public profiles does not expose private CRM records.

### 5 — Explain the next step

Three brief facts: browse approved public listings, contact the named representative, receive a response from that company. Explain the process accurately without treating publication review as a guarantee of property quality, commercial outcome or verified ownership.

### 6 — Footer and professional journey

Clear support/legal links, platform identity and a restrained **Blaqks One for professionals** entry. CRM features and plan marketing live on dedicated business pages, instead of interrupting a buyer's journey with large subscription forms.

## 4. Company homepage: inventory and confidence

```text
COMPANY HEADER
│
├─ 1  Company positioning + architectural image + property search
├─ 2  Selected approved properties + View all
├─ 3  Areas served / actual services
├─ 4  Meet the approved team
├─ 5  Concise company story + contact invitation
└─ 6  Company footer and public business details
```

Use the company's actual strengths and approved imagery. Do not create template claims about market leadership, years in business, sales, reviews or awards. Where the company has no approved team/services content, omit that module cleanly instead of leaving empty cards or inventing content.

If no public inventory is available, keep the catalogue's honest empty state but move useful approved company information higher on the homepage. Do not make the home page a long sequence of empty property sections.

About and Contact remain complete standalone pages. A homepage teaser links to them; it does not duplicate their full text/forms. General company enquiries go to the company's Admin queue. Property enquiries keep their listing-specific approved agent route.

The four themes share this task order but may change composition: photographic/overlapping; compact split; light editorial; dark architectural. They are not four copies differing only in colour, and they cannot place essential search/contact information behind animations. Theme names and final visual treatments remain for owner review.

## 5. Search results: one working surface

```text
HEADER
SEARCH SUMMARY / EDIT SEARCH
ACTIVE FILTERS + PUBLISHED RESULT COUNT + SORT
DESKTOP: FILTER COLUMN | PROPERTY GRID
MOBILE: FILTER/SORT CONTROLS → FULL-WIDTH PROPERTY CARDS
PAGINATION
```

Desktop filters group Location, Property, Price and Availability/readiness. Keep common filters directly accessible; put specialist criteria in meaningful disclosures. Avoid a filter bar, a duplicate filter form and another advanced form all competing above results.

On phones, Filters opens a full-height accessible drawer with staged selections, a clear Apply action, Reset and a visible number of active filters. Cancel preserves the current applied search. Sorting is quick and separate. Match useful controls to available data; do not show controls with no implemented behaviour.

Search state lives in shareable crawlable URLs, with meaningful defaults and controlled indexing of combinations. Returning from a listing restores filters, page and scroll position. Announce updates; prevent late requests from replacing newer results. Start with a 12-item page and explicit pagination to match existing product collection conventions; confirm final public density in prototype review.

No match state keeps all selected filters visible and suggests specific removable restrictions. Do not silently widen the budget/location, mix unlike price bases or include unpublished properties to fill the grid. A map view is a later explicit feature unless its approved location contract, accessible fallback and performance are implemented.

## 6. Property detail: one confident decision page

```text
BACK TO RESULTS / BREADCRUMB
GALLERY: LARGE LEAD IMAGE + SUPPORTING THUMBNAILS
TITLE + LOCATION + PRICE/BASIS + CORE FACTS
CONTENT COLUMN                         ENQUIRY COLUMN
  Overview                               Approved agent/company
  Features and amenities                 Enquire / approved contacts
  Floor plans                            Relevant disclosure
  Location at approved precision
  Listing/permit information
RELATED ELIGIBLE PROPERTIES
```

Desktop enquiry panel can remain sticky within its section without covering the footer or focused content. Mobile uses a compact bottom enquiry action with safe-area spacing; it opens a labelled form and does not hide page content or the on-screen keyboard. Avoid repeating a long form after every property section.

The gallery must support keyboard, touch, a clear close action, image alternatives and a truthful count. Floor plans and any genuine tours are deliberately opened; they are not heavy homepage assets. Decorative 3D never implies that a property has a tour or measured model.

Keep approximate/publicly permitted location distinct from private exact-unit instructions. Include the relevant permit facts and source company/agent in an understandable place. Related listings are a small eligible set from the correct host scope, with no infinite feed. Enquiries identify the exact displayed listing and receiving company; stale/withdrawn publications refuse new intake clearly.

## 7. Company and agent profile pages

Public company profile on the general website: approved company header, short introduction, areas/services, eligible general-site inventory, opted-in approved team and contact destination. An external company-website link is visibly labelled and available only while its verified site is active.

Agent profile: approved professional identity and brokerage, concise specialties/areas/credentials, then their eligible listings. No separate personal website or personal-domain editor. Contact actions preserve current company eligibility; existing leads keep their original company if staff leave.

Visitors can reach these profiles from listing cards/details and directories without losing their original property search context. On a company website, the team directory and agent profiles stay within that company and its site inventory.

## 8. Website settings: group the work into six areas

Replace an undifferentiated list of eleven equally prominent settings destinations with six task groups. The existing settings fields remain; this is their new navigation hierarchy.

| Group      | Sections inside                                                                                        | Typical task                              |
| ---------- | ------------------------------------------------------------------------------------------------------ | ----------------------------------------- |
| Overview   | Setup progress, live/draft status, required actions, preview/live links                                | Understand what needs attention           |
| Design     | Theme, branding, hero/media, motion and preview                                                        | Change visual presentation                |
| Content    | Pages/navigation, public company details/contact, services and approved people                         | Prepare public information                |
| Properties | Publication status, destinations, homepage selections and listing eligibility                          | Manage what visitors can browse           |
| Enquiries  | Form presentation, routing explanation, response hours, notification settings and permitted aggregates | Understand and configure enquiry handling |
| Settings   | Domain/SSL, search/SEO, privacy/consent, collaborators/history and site pause                          | Manage the site's operating configuration |

Desktop editor: compact section rail, readable editing canvas and optional contextual preview. Show the actual company and independent Draft, Review and Live status. Preview controls can switch page and phone/desktop size without losing edits. Narrow screens use a section selector and a dedicated preview rather than squeezing two columns.

Use **Save draft**, **Preview**, **Submit for review** and **View live** with distinct outcomes. No universal Save and publish button that bypasses approval. Field groups validate locally and on the server. Confirm only consequential changes such as site pause/domain removal; avoid confirmation dialogs for every harmless edit.

Platform Websites has a separate hierarchy: **General site**, **Review queue**, **Company sites**, **Policies & access**, **Health & recovery**. General-site content uses the editor; cross-company review uses submitted public snapshots; operational recovery uses restricted metadata. Do not mix private CRM lead records into platform website settings.

## 9. How the structure supports the visual effect

Give the memorable architectural motion to the opening homepage composition and deliberate gallery moments. Keep results and enquiry work stable. The effect can be removed without losing a navigation path, important text or property information. Use the motion/performance budgets in the [visual brief](website-visual-refinement.md).

Final owner-accepted motion direction: lightweight hero depth initially, static phones/reduced motion, and no full interactive 3D renderer in the initial delivery. Genuine property tours are separately opened assets. Validate useful content and interaction speed before accepting any decorative effect.

Design a strong static version first, then add supported desktop depth. No scroll hijacking, timed intro, loading gate or pointer-only interaction. Mobile visitors receive a deliberately composed layout, not a shrunken desktop canvas.

## 10. Reviewable design deliverable

The next visual prototype should show the general homepage, company homepage, search results, property detail and company Website editor as a connected journey, at desktop and phone sizes. Include a dark company-theme example and static/reduced-motion variants. Use fictional labelled content; forms/domains/publication actions must not pretend the backend exists.

Review first: can a visitor search, inspect a property and understand who receives the enquiry without guessing? Can an Admin identify the live version, change a draft and understand the review step? Then judge typography, imagery, depth and transitions. A source-based blueprint is not a completed or visually tested prototype.
