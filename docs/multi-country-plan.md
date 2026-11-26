# Multi-country support — proposal

Status: **proposal only** (2026-11-26). Nothing here is implemented, approved or scheduled. The
owner asked for the shape of the work so it can be picked up in a later version.

Countries in scope: United Arab Emirates (AE), Canada (CA), United States (US), United Kingdom
(GB), Australia (AU) and Singapore (SG). UAE stays the first, fully supported market.

## Decisions proposed for owner approval

1. **Country belongs to the company.** The owning Admin picks it during sign-up; invited staff
   inherit it and cannot change it. It is immutable once the workspace holds records.
2. **One currency per company, no conversion in v1.** Amounts keep integer minor units; the AED
   `fils` helper becomes currency-aware (2 decimals for AED/CAD/USD/GBP/AUD/SGD).
3. **Location taxonomy is data, not code.** Country → region → community lives in tables, with the
   existing free-text values kept readable for old records.
4. **The broker marketplace and cross-company co-broking stay UAE-only.**
5. **Websites follow the company's country.** Company sites inherit it automatically; the general
   Blaqks One site gets country-prefixed routes.
6. **Platform reporting groups by currency** rather than converting amounts into one currency.

Product-decision entries in `docs/product-decisions.md` and a service-boundaries decision-log entry
(new country module, and the companies → countries foreign key) are required before code starts.

## Why the company and not the user

- Staff of one company must share one data model; a per-user country would make currency, tax and
  address taxonomies ambiguous inside a single workspace.
- Only the owning Admin creates a company (`docs/admin-owned-teams.md`), so there is exactly one
  natural moment to ask.
- Every consumer — records, reports, exports, finance, websites — can then read one value.

The frozen browser demo is not part of this work. Connected mode only.

## Country registry

A new `platform`-owned module (sibling under `services/crm-api/src/`) owns `platform_countries`; no
other module writes it. `docs/service-boundaries.md` rules apply.

| Column                                    | Purpose                                                             |
| ----------------------------------------- | ------------------------------------------------------------------- |
| `code` (PK, ISO 3166-1 alpha-2)           | `AE`, `CA`, `US`, `GB`, `AU`, `SG`                                  |
| `name`, `active`                          | Display name; inactive countries cannot be chosen                   |
| `currency`, `currency_minor_units`        | ISO 4217 code and decimal places                                    |
| `timezone`                                | IANA zone used for "today", schedules and metrics                   |
| `phone_calling_code`, `phone_rule` (JSON) | National number length/pattern and trunk prefix                     |
| `address_labels` (JSON)                   | Region and community labels ("Emirate", "Province", "State")        |
| `taxes` (JSON)                            | e.g. `[{ code: "VAT", rate_bp: 500, applies_to: "deal" }]`          |
| `features` (JSON)                         | `broker_marketplace`, `off_plan`, `holiday_homes`, `listing_permit` |

`crm_companies` gains `country_code` (NOT NULL, default `AE`, FK to `platform_countries`). Existing
rows are backfilled to `AE`, so UAE behaviour is unchanged on day one.

Location tables: `country_regions` and `country_communities` (country/region FK, slug, display name,
aliases, sort). UAE is seeded from the current emirate and community lists; existing records keep
their stored text and continue to display if a catalogue entry is missing.

## Server contract

- `GET /api/crm/platform/countries` — public, active countries only, for the sign-up selector.
- The session and workspace payload gains `country: { code, currency, minorUnits, timezone, phone,
labels, taxes, features }`. The frontend never hard-codes AED, `+971` or `Asia/Dubai` again.
- Phone normalisation, currency validation, tax application and permit fields read the company's
  country profile.
- Marketplace, off-plan and holiday-home endpoints return `403 country_not_available` outside
  their enabled countries.

## Sign-up

The company sign-up form asks for the country (default AE) before the company details. The server
validates that it is active, stores it on the company, and the invitation flow inherits it. No
staff-facing country field exists anywhere.

## Websites

- **Company websites** already render per host. They read the company's country for currency,
  region labels, phone display and SEO metadata — one codebase, no per-country fork.
- **The general Blaqks One site** uses country-prefixed routes (`/<country>/<region>/<community>`)
  with a switcher that only lists countries with published inventory. Existing UAE-only paths keep
  working through redirects. UAE remains the default.
- Marketplace pages remain UAE-only and are not linked from other countries.

## Packets

Each packet follows the normal delivery protocol (one bounded change, files ≤150 lines, focused
checks, full CI).

| Packet | Scope                                                                                | Size           |
| ------ | ------------------------------------------------------------------------------------ | -------------- |
| M1     | `platform_countries` table, seeds for the six countries, read API                    | S              |
| M2     | Company `country_code`, sign-up selector, backfill, session profile                  | M              |
| M3     | Server enforcement: phone, currency, taxes, feature gates                            | M              |
| M4     | `country_regions` / `country_communities`, API, UAE backfill                         | M              |
| M5     | CRM country context, location pickers, remove hard-coded AED/Dubai copy              | M              |
| M6     | Money helpers become currency-aware; finance screens show company currency and taxes | M–L            |
| M7     | Company website fields per country (labels, currency, phone, legal details)          | M              |
| M8     | General site country routes, switcher and redirects                                  | L              |
| M9     | Per-country compliance fields (permits, registrations, tax documents)                | L, product-led |

## Testing

- API fixtures build one AE company and one CA company; assert currency, phone, tax and feature
  gates for each, including `country_not_available` responses outside the UAE.
- Browser tests: sign-up country selector, location pickers per country, Marketplace hidden for
  non-AE, company website in CAD.
- Standard checks: `npm test`, `npm run build`, `npm run test:api`, `npm run test:server:e2e`,
  `npm run check:lines`, `npm run check:boundaries`, `npm run check:i18n` plus Rust fmt/Clippy/tests.

## Risks

- Silent AED defaults hiding currency bugs; tests and fixtures that assert `AED` or `+971`.
- Timezone arithmetic in metrics and scheduling once it is no longer `Asia/Dubai`.
- Browser/backup JSON formats are frozen; existing records need a documented migration path.
- Phone lookups and uniqueness rules assume UAE normalisation today.
- Public URL changes need redirects so existing links and SEO rankings survive.

## Non-goals for v1

Currency conversion and FX rates, per-user country or timezone, translated legal documents,
marketplaces outside the UAE, and any second interface language (the product stays English-only).

## Open questions for the owner

1. Can a company change country later? (Proposal: only through support while empty.)
2. Are taxes applied to deals and payments, or reported only?
3. Do company websites need country-specific legal pages at launch, or later?
4. Should the general site use routes (`/ca/...`) or per-country domains?
5. Do platform metrics need a single display currency, or grouped totals?
6. Is cross-country co-broking ever wanted, or UAE-only permanently?
