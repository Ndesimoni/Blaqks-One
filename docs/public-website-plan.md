# Public website plan

Status: **planned, not started** (owner, 2026-10-20). This plan builds the public side of Blaqks One: one general website with every company's approved listings, and optional company websites. It follows the [platform system design](platform-system-design.md), the [public listings decisions](product-decisions.md#public-listings-decided-2026-10-12), the [company website decisions](product-decisions.md#company-websites-decided-2026-10-20) and [service boundaries](service-boundaries.md). Packets WEB1–WEB9 replace the website rows W1–W4 in [roadmap §14](claude-implementation-roadmap.md#concrete-work-packets). The messaging packets with the same letter (W1 for WhatsApp) are unaffected.

## What the owner decided

- **One general website** lists every company's approved listings. A company may add its **own website** as a paid add-on or a higher-plan feature.
- A company site uses a **Blaqks One subdomain** by default, or the company **connects its own domain** with automatic SSL. We do not buy domains for companies yet.
- Each company chooses **one of 4 themes**, its **logo** and **one brand colour**. Fixed pages: Home, Listings, Listing detail, About, Contact. Companies may **add their own pages**.
- **No licence check** for a site to go live. Publishing a listing still needs a verified licence and Super Admin approval of the exact version.
- **One approval covers both sites.** Per listing, the company chooses "general site + my site" or "my site only".
- Limits: **2 live listings per team** applies everywhere. **2 teams per property** applies only to the general site.
- Public sites launch in **English**, built on the [language foundation](i18n.md) and right-to-left ready.
- The 4 themes are designed and reviewed with the owner before they are built.

## Architecture: one website application, many sites

One rendered website application (Next.js, as the platform design proposes) serves every site. A request is matched to a site by its **host name**:

| Host                               | Site                                     | Listings shown                                          |
| ---------------------------------- | ---------------------------------------- | ------------------------------------------------------- |
| The platform domain (and `www.`)   | General site, Blaqks One design          | All published listings marked for the general site      |
| `<company-slug>.<platform domain>` | Company site, the company's chosen theme | That company's published listings, both channel choices |
| A verified custom domain           | The same company site                    | The same                                                |
| Any other host                     | None                                     | `404`, never a default site                             |

The website reads only the **public catalogue API** (`/api/public`). It never calls the CRM API, never receives CRM cookies and holds no CRM credentials. The server resolves the site from the host on every request, so a visitor can never ask for another company's site by changing a parameter. Bug fixes and new features reach every site at once, and cost does not grow with each company.

Locally, sites are tested with `*.localhost` host names (`keys.localhost:3000`) against the disposable Docker database.

## Backend modules and tables

Each new module owns its own PostgreSQL schema ([service boundaries](service-boundaries.md) rule 11 and the own-schema rule).

| Module          | Owns                                                                                                                       | Talks to others through                                                                    |
| --------------- | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `publications/` | Listing revisions, approval decisions, channel choice per listing, slot counting for the listing limits                    | Records-owned property lookup; `workspaces::lock`; `outbox::enqueue` on every state change |
| `sites/`        | Company sites, theme/logo/colour settings, slugs, domains and their verification state, custom page revisions and approval | Company profile view; plan entitlement check; `outbox::enqueue` for domain and cache jobs  |
| `catalogue/`    | Public read tables filled from the outbox: active listings, agent profiles, site settings, host map                        | Only its own tables; may later run as a separate process with a read-only database role    |
| `enquiries/`    | Durable, idempotent enquiry intake with the source site and listing revision                                               | A lead-creation command in the destination workspace; `outbox` for notifications           |

Publications store each listing's channel choice: `general_and_company` or `company_only`. "Company only" is offered only while the company has an active site. If the site lapses, those listings stop showing, and the company is told it can move them to the general site, which needs no new approval because the approved content is unchanged. Moving a listing from company-only to the general site uses the general-site slot rules at that moment. A rejection never names the other teams.

## Company site lifecycle

1. **Entitlement.** The site is a plan feature. Until billing exists, the Super Admin turns the feature on per company as a plan setting with immutable history, like the current seat limit. It gives no access to company business data.
2. **Setup in the CRM.** An Admin (or staff with a new `site.manage` grant, off by default) opens a **Website** screen and chooses a slug, a theme, the logo, the brand colour and the About/Contact text.
3. **Review.** Logo, About text and company pages are public content, so they are frozen as a version and approved by the Super Admin, like listings. Theme and colour are picked from safe options and need no approval. The colour is checked for contrast in both themes and adjusted automatically if text would be unreadable.
4. **Live.** The site goes live on its subdomain at once. A licence is not needed.
5. **Lapse.** If the plan ends or the company is archived, the site shows a short "no longer available" page for 14 days, then returns `404`. Custom domains are removed from our edge immediately so a dangling DNS record cannot be taken over. The company's listings stay on the general site where they were marked for it.

Reserved slugs (for example `www`, `api`, `app`, `crm`, `admin`, `mail`, `help`, `status` and the platform's own names) are refused. Slugs are unique, lowercase and changeable at most once every 30 days, with a redirect from the old slug.

## Domains and SSL

| Level                      | How                                                                                                                                                                                                                                                                                                                                                                           |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Subdomain (default)        | One wildcard DNS record and one wildcard certificate for `*.<platform domain>`. No per-company work.                                                                                                                                                                                                                                                                          |
| Connect your own domain    | Use **Cloudflare for SaaS custom hostnames**, which fits the Cloudflare CDN already chosen in [Tech stack](tech-stack.md). The Admin enters `www.example.ae`; the CRM shows the CNAME and verification record to add; a worker job checks status until Cloudflare confirms ownership and issues the certificate; the domain then goes live. Certificates renew automatically. |
| Bare domain (`example.ae`) | Many registrars do not allow a CNAME at the bare domain. Recommend `www.` as the site address and a redirect from the bare domain, with step-by-step guides for the common UAE registrars.                                                                                                                                                                                    |
| Buying a domain            | Deferred. Show a guide instead.                                                                                                                                                                                                                                                                                                                                               |

Domain states: Pending DNS, Verifying, Active, Failed (with the reason), Removed. One active custom domain per site at first. The subdomain keeps working and redirects to the custom domain once it is active. Domain changes are logged in Team activity without DNS tokens.

## Search engines and duplicate listings

A listing can appear on the general site and on its company's site. Each listing page names one **canonical** address: the company site when the listing is shown there, otherwise the general site. Each host has its own sitemap containing only its own listings and pages. The "Also listed by …" grouping on the general site is unchanged.

## Company pages

Companies build extra pages from **structured blocks**: heading, text, image, image gallery, listing grid (their own published listings, filtered), team members with approved public profiles, and contact form. There is no free HTML, script or embed, so a company page cannot attack visitors or break the theme. Pages are versioned and approved like other public content. Limit: 10 extra pages per site at first, with a slug and a navigation position.

## Enquiries

Enquiries work as already decided: the server routes them from the publication to the approved agent, then to that team's Admin queue. The enquiry also records the **source site**. An enquiry form on a company page (not about a listing) goes to that company's Admin queue. General enquiries on the general site stay an open decision ([platform design](platform-system-design.md#decisions-still-needed-before-implementation)).

## Security and reliability checks

- The host is the only way a site is selected; unknown and removed hosts get `404`.
- The catalogue API returns only the public allowlist; private Property fields never appear, whichever site is asking.
- No CRM session, cookie or CRM origin on any public host. Strict content security policy; uploaded logos and images are processed derivatives only (WEB1).
- Rate limits and bot protection per host and per enquiry form.
- Cache keys include the host. Withdrawing a listing purges it from every host and sitemap within the agreed takedown window.
- Removing a domain at Cloudflare happens in the same lapse/archive job that disables the site; a delayed job can never re-add it.

## Work packets

Each packet is one bounded cycle with its own design, security review where marked, tests and owner check. Order follows dependencies; design packets can run alongside backend work.

| Packet | Scope                                                                                                                                         | Depends on     | Review                     |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------------- | -------------- | -------------------------- |
| WEB1   | Private media storage and processed public derivatives (was W1)                                                                               | Hosting choice | Security                   |
| WEB2   | `publications/`: public agent profiles, frozen listing revisions, channel choice, slot limits, Super Admin approval queue in the CRM (was W2) | WEB1           | Architecture, security     |
| WEB3   | `catalogue/` and `enquiries/`: public API, host map, outbox projections, idempotent enquiry intake with source site (was W3)                  | WEB2, outbox   | Security                   |
| WEB4   | Design: the general site and the 4 company themes, as design canvases for owner approval                                                      | None           | Owner, product designer    |
| WEB5   | General website: home/search, results, listing detail, agent pages, enquiry form, SEO, sitemaps, takedown (was W4)                            | WEB3, WEB4     | Accessibility, performance |
| WEB6   | `sites/` and the CRM Website screen: entitlement, slug, theme/logo/colour, About/Contact approval, subdomain routing, lapse handling          | WEB3, WEB4     | Security                   |
| WEB7   | The 4 company themes built on one shared component set, with canonical rules and per-host sitemaps                                            | WEB5, WEB6     | Accessibility, owner       |
| WEB8   | Custom domains through Cloudflare for SaaS: connect flow, verification job, status screen, redirect, removal on lapse                         | WEB6, hosting  | Security, DevOps           |
| WEB9   | Company pages from structured blocks, with versioning and approval                                                                            | WEB7           | Security                   |

WEB1–WEB5 deliver the general site; WEB6–WEB7 deliver company sites on subdomains; WEB8 and WEB9 can ship later without blocking the launch. Real domains, SSL and Cloudflare need the hosted environment (roadmap P10 and O1); until then everything is tested locally with `*.localhost` hosts.

## Still open

- The **platform domain** for the general site and the subdomains (for example `blaqksone.com`), and whether it is registered.
- Plan names and prices for the website add-on (platform phase).
- Whether a site may later have more than one custom domain, and Arabic for public sites.
- General enquiries without a listing on the general site.
