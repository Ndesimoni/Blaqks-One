# Public website visual refinement and motion direction

Date: **2026-10-28**. Status: design brief with a separate interactive review prototype; the owner's canvas overview has been inspected, while detailed references remain unavailable. The production website is not built and field performance is untested.

**Prototype checkpoint:** the [complete design preview](website-design-preview.md) now provides rendered, clickable review screens based on this direction and the revised structure. It is separate from production; the performance budgets below are still targets rather than measured field results.

**Structure update:** the owner explicitly requested a better structure, rather than preserving the screenshot layouts. Follow the [website structure blueprint](website-structure-blueprint.md) for navigation, homepage sequence, results/detail journeys and grouped settings. It supersedes the earlier layout-preservation recommendations below; the brand, publication/privacy rules and performance requirements still apply.

The owner wants to refine the existing Claude design into a smooth, striking, professionally finished real-estate experience, with 3D effects if they can remain fast. Improve its structure as well as its presentation, keeping the approved green/neutral/restrained-gold brand. Scope is **Blaqks One's general website and company websites only**. Agent profiles live inside these websites; no standalone agent sites.

**Final motion direction accepted by the owner:** lightweight visual depth for launch, one restrained homepage hero effect, stable search/text/cards/enquiry controls, and a static phone/reduced-motion baseline. Full interactive 3D is deferred pending a useful purpose and measured evaluation. Genuine property tours load only on deliberate opening. Detailed performance budgets below remain proposed test targets.

## References and evidence

- [Owner's Claude design](https://claude.ai/artifact/LW62BWKAfGnnjGaCA5GrJG#page-dcb81aee8d83).
- [Owner's TikTok real-estate inspiration](https://www.tiktok.com/@marcinteodoru/video/7679640080809479454).
- [Approved CRM visual baseline](design-standards.md) and [CRM reference previews](design-refresh.md#visual-previews).
- [Website settings and functional plan](website-settings-plan.md) and [public website delivery plan](public-website-plan.md).

Both external reference fetches failed with CONNECT/HTTP 403 in this environment, including retries with additional execution permissions. The linked interactive Claude artifact and TikTok video could not be inspected directly; the subsequently supplied Claude overview screenshot was inspected as described below. No claims about the video's actual effects, layout, colours or technology can be made. Exported design source/close-ups and a short video/screen recording would support more precise reference matching. Do not attempt to access a private account or reuse another site's code/assets.

### Screenshot evidence supplied by the owner

The owner subsequently supplied an overview screenshot of the Claude design canvas. It shows the general website across a photographic/search homepage, a results/filter layout, property detail/gallery and a narrow responsive layout. Below are four company themes: a large photographic hero with an overlapping search panel; a light split hero with compact inventory; a restrained light editorial composition; and a dark, image-led luxury composition. These are composition observations, not claims about the interactive artifacts or their exact implementation.

The overview was displayed at 1996 × 1248 after resizing from 2880 × 1800, with each website occupying a narrow part of the canvas. Small copy, precise spacing, contrast ratios and control behaviour cannot be reliably audited from it. The TikTok video remains uninspected. The screenshot provides a starting point for visual refinement, while exported source or close-ups remain useful for matching the existing design accurately.

### Refinement of the visible compositions

| Existing visible direction    | Preserve                                                                    | Refine next                                                                                                                                                         |
| ----------------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| General photographic homepage | Search-led opening, property imagery, listing groups and location discovery | A cleaner hero/search hierarchy, fewer competing visual bands, consistent card proportions and clearer separation of property browsing from CRM product information |
| General search results        | Filters beside results on desktop and compact property summaries            | Predictable filter/apply/reset behaviour, active filter chips, readable prices/bases, mobile filter drawer and preserved return-to-results state                    |
| General property detail       | Gallery-led presentation, facts and enquiry/contact area                    | Stronger price/availability hierarchy, calm section navigation, explicit approved agent identity and reachable mobile enquiry action                                |
| Company theme 1: photographic | Architectural hero and prominent search                                     | Better contrast behind search/text, restrained layered depth and simpler spacing below the hero                                                                     |
| Company theme 2: split layout | Compact light hero, immediate search and visible inventory                  | Stronger image crop, consistent search controls and a deliberate mobile stacking order                                                                              |
| Company theme 3: editorial    | Quiet white space, large property imagery and understated composition       | More confident type hierarchy, aligned details and editorial rhythm without long empty gaps                                                                         |
| Company theme 4: dark luxury  | Deep-green setting, dramatic imagery and contrasting headings               | Restrained gold accents, readable text/controls, selective depth and a lighter interaction load than its visual drama suggests                                      |

These are working descriptions of the four visible themes, not new approved theme names. Keep them as four options built from shared search/listing/gallery/enquiry components. A refined dark-theme hero can be the first motion pilot; the general-site hero remains primarily a fast search entry point.

The depth pilot should use a layered architectural image, subtle foreground/background separation and restrained image-only pointer movement on supported desktops. Keep heading/search stationary and readable. Use a static mobile composition; do not imply a real property tour from a decorative 3D treatment. Actual property tours are separate assets with accurate labels and explicit visitor activation.

## 1. Intended visual character

Aim for a premium architectural editorial experience: strong property photography, precise typography, generous but purposeful whitespace, polished search and discreet depth. Stunning should come from composition and image quality rather than covering a slow interface with animation.

Keep forest green for identity, calm neutral backgrounds and restrained gold for emphasis. Use the current semantic tokens in CRM settings; public company sites use their approved brand colour only where contrast remains readable. Do not revive the parked Midnight redesign, add a new font dependency or discard the existing Claude design without a deliberate reviewed choice.

Use one confident headline, a supporting sentence and one clear next step in each major section. Public company pages can be more expressive than CRM settings, but property facts, price basis, search and enquiry actions always remain easy to scan. No invented reviews, unsupported success statistics or unverified badges.

## 2. General-site page direction

| Surface             | Proposed refinement                                                                                                                       | Keep immediately usable                                                           |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Header              | Restrained wordmark, clear buy/rent/holiday navigation, company/agent discovery and separate CRM link; subtle surface change after scroll | Keyboard/mobile menu, visible focus and stable header height                      |
| Hero                | One excellent architectural image, strong title and carefully layered foreground; optional depth behind the content                       | Real rendered heading and buy/rent/holiday search visible before any effect loads |
| Search              | A calm, legible search panel placed where the first viewport makes its purpose obvious                                                    | Purpose, location and useful initial filters; expanded filters preserve state     |
| Results             | Consistent image ratios, restrained borders/shadows, clear price/basis, location and key facts                                            | Filtering, sorting, pagination, URL state and honest empty/loading states         |
| Listing cards       | Photography leads; clear facts and small approved representative identity; slight lift or image motion on capable hover devices           | No hover-only information; no moving text or controls                             |
| Property detail     | Spacious gallery, prominent price and basis, clear facts, readable description, approved agent and contact options                        | Gallery controls, enquiry and return-to-results work with effects disabled        |
| Locations           | Editorial image tiles with explicit place labels and real eligible search links                                                           | No carousel required to reach essential destinations                              |
| Company/agent pages | Consistent approved identity, qualifications labelled accurately and eligible inventory                                                   | No invented public profile fields or private CRM data                             |
| Footer              | Clear company/platform identity, relevant navigation, support/privacy/terms and accessibility-friendly contrast                           | No unnecessary link maze or oversized decorative footer                           |

The general website is a practical property-discovery service with visual distinction. Property detail and results should be calmer than the homepage. A visitor should never need to complete an animation to find a price or contact an agent.

## 3. Company-site direction

Reuse the shared search, listing, gallery and enquiry components. Customise the approved theme, logo, brand colour, hero, About/services and team content. Keep the existing four-theme plan; first inspect the owner's current themes before proposing alternatives.

The company's identity must be recognisable without changing fundamental control behaviour between themes. Each theme needs the same accessibility, responsive and performance quality. Layout variety is allowed; an expensive animation dependency in every theme is not necessary.

Home balances a branded architectural hero, search, selected approved listings, service areas, a concise company story and an enquiry CTA. Avoid repeating the same giant hero on every inner page. Sites without approved listings get an honest empty state, not another company's properties or fictional live inventory.

## 4. Website settings editor direction

Company Website uses a compact section rail, a clear editing area and an optional preview pane on sufficiently wide screens. Sections: Overview, Identity & contact, Appearance, Pages, Listings, Public people, Enquiries, Domains, Search & sharing, Privacy, History & access. Use the functional settings plan to decide which fields appear; style cannot add unimplemented capability.

Display the actual site/company and current draft/live status near the title. Editing a draft, submitting it for review and viewing the public site are separate clearly labelled actions. Saving feedback should appear beside the affected action without moving the form. Unsaved drafts and conflict recovery remain protected.

Appearance has a small set of excellent choices: theme preview, brand colour with accessible examples, image crop and a motion preset. Initial presets are **Static** and **Subtle depth**, subject to theme capability and platform performance controls. Enhanced real-time 3D is deferred and has no initial settings control. A company cannot override visitor reduced-motion preference or inject its own scripts/WebGL scene.

On phones, use one readable editor column, a section selector and a dedicated full-screen preview. Keep the primary form action reachable without covering fields or the keyboard. Platform Websites adds focused review queues and operational health; avoid a decorative wall of unrelated metrics.

## 5. Depth and 3D: progressive enhancement

| Level                    | Technique                                                                                                  | Intended scope                                    | Failure/fallback                                                       |
| ------------------------ | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------- | ---------------------------------------------------------------------- |
| Base                     | Static responsive image, clean composition, gradients for text contrast only, measured shadows             | Every device and page                             | Full usable site with no animation engine                              |
| Subtle depth             | CSS transforms on a small number of image/decorative layers; gentle hover tilt; one brief entry transition | Homepage hero and limited nonessential decoration | Base visual on coarse-pointer/reduced-motion/unsupported devices       |
| Enhanced depth, deferred | A separately loaded, compressed lightweight scene or model with bounded rendering                          | Later evaluation for a specific useful experience | Keep the static poster without layout shift if loading/rendering fails |

Start with CSS depth and excellent imagery. Use real-time WebGL only if the reference review identifies a specific visual benefit that CSS or a short optimised asset cannot provide. A hero is not permission to ship a 3D library with every route. No WebGL is required for property cards, settings forms or the enquiry flow.

Desktop pointer tilt should affect decorative imagery only, with a small proposed range (about 2–4 degrees) and no text/pointer-target distortion. Update transforms through one animation-frame scheduler, avoid state-driven rerenders on every pointer move, and stop when the hero is offscreen. Touch devices use a static composition by default; do not request device-orientation access.

Avoid scroll hijacking, forced horizontal journeys, long pinned introductions, autoplay audio, custom cursors over forms, infinite shimmer and multiple moving layers across listing grids. If parallax is used, it should be low amplitude and optional; native scrolling and browser Back must remain predictable.

Enhanced assets load only when the hero is visible, meaningful content has loaded and the device/browser supports the effect. Respect reduced motion, supported data-saver signals and observed performance; do not rely solely on browser network/device-memory APIs, which are not universally available. Unknown capability should receive the inexpensive baseline.

Pause rendering on hidden tabs/offscreen content, cap pixel ratio and frame rate as measured, release GPU resources after leaving the page, and preserve the poster on context loss. Prevent download retries from becoming an infinite loop. No effect may block search, links, gallery keyboard input or enquiry submission.

## 6. Motion specification

| Interaction                   | Proposed starting duration                 | Behaviour                                                  |
| ----------------------------- | ------------------------------------------ | ---------------------------------------------------------- |
| Hover/focus colour and border | 120–180 ms                                 | No geometry/layout movement                                |
| Card lift/image depth         | 160–220 ms                                 | Small transform, no hidden information                     |
| Menu/dialog disclosure        | 180–240 ms                                 | Immediate input response; focus handled correctly          |
| Section entrance, optional    | 220–350 ms                                 | Small fade/translate once; content visible if script fails |
| Reduced motion                | Immediate or minimal nonspatial transition | No tilt/parallax/continuous 3D or stagger blocking content |

These are initial design values, not measured results. Repeated content should not stagger for seconds. Use transform/opacity rather than animating layout properties. Give effects to selected moments so the rest of the site feels calm and fast.

## 7. Performance acceptance targets

Measure on real rendered pages; a visually impressive recording is not a performance test. The following are proposed starting budgets to validate before implementation acceptance:

- Core Web Vitals at the 75th percentile when field data is available: LCP ≤2.5 seconds, INP ≤200 ms and CLS ≤0.1. Use controlled mobile lab measurements first and report their actual conditions separately.
- No 3D dependency or model in the critical path for the search, heading, primary hero poster or property detail. The base HTML contains the useful content and controls.
- Initial nonessential effect JavaScript ≤30 KB compressed. For a later enhanced-renderer evaluation only, target its separate optional chunk at ≤150 KB compressed and scene assets at ≤500 KB compressed; exceeding a budget requires an explicit measured design tradeoff, not silently raising it. No enhanced renderer is part of the initial website scope.
- Initial mobile hero image target ≤250 KB, responsive AVIF/WebP where supported and a compatible fallback. Final encoding is judged by visible image quality and device dimensions. Do not ship the desktop image to every phone.
- Reserve image/canvas dimensions. Prioritise the actual LCP image; lazy-load lower-page galleries and route-specific effects. Avoid downloading entire listing galleries on the results page.
- Compare effects-on against the exact same page with effects-off. Reject effects that create repeated long main-thread tasks, interaction lag, unstable layout or materially worse initial load under the agreed mobile profile.
- Aim for smooth motion on supported desktops; adapt or disable when measured frame time cannot keep up. Never promise 60 fps on every device.

Do not preload optional models, autoplay large background videos or add animation libraries merely for a reveal. Cache versioned public assets efficiently; private CRM pages/enquiry responses remain outside shared caching.

## 8. Refinement workflow and evidence

1. Obtain screenshots/design export of the Claude pages and a screen recording/key frames of the inspiration, or inspect them when access is available. Identify what the owner likes: composition, architecture animation, transitions, photography or interaction.
2. Audit the existing design page by page: keep/refine/remove, with a reason tied to visitor tasks. Separate observed reference details from new suggestions.
3. Prepare one reviewable general homepage, a company-home variation and the Website appearance editor. Include a static mobile version and lightweight desktop hero depth; full real-time 3D remains deferred.
4. Review property search/results and detail/enquiry as a complete journey so the hero does not become the only polished page.
5. Build an isolated interactive design prototype with fictional labelled content, without CRM/publication/provider changes. It must not claim live listings, working domain verification or actual enquiry delivery.
6. Compare desktop/mobile and both supported display modes, reduced motion, keyboard/focus, slow network, image failure and effects disabled. Record screenshots and specific measurements before accepting the enhanced effect.
7. Implement public-site production routes only through the existing WEB packets, preserving approval and data boundaries. A design review does not establish that the publication or enquiry backend is finished.

Delivery is complete when there is a visually inspected refinement of the actual source, an interactive prototype of the important journeys and evidence of usable fallback/performance. This brief alone does not meet that completion bar.
