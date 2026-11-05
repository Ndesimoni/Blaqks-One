# Blaqks One marketplace — source reconstruction

This is a fresh reconstruction of the agreed marketplace design:
https://blaqks-one-welcome-design.cocoamoat2.chatgpt.site/

It is not an export of the inaccessible original source. The single-company cream/gold website is a separate project.

## Run locally

Requires Node.js 20 or later. No dependencies or installation required.

```sh
cd websites/marketplace-rebuild
npm run dev
```

Open http://localhost:4173. Stop with Ctrl+C.

## Included pages

Home; properties with URL filters; property details and gallery; distress/discount deals;
agents (five per page); agent profiles; companies and company profiles; saved/recent/compare;
about; contact; help; professional landing; signup/signin; verification; expired-code state;
company setup; invitations; ready/workspace preview; reset-password states.

## Agreed design

Navy, white and restrained gold; serif headlines; left-side header search;
For Agents & Companies account entry; three distress properties on the homepage;
one final compact featured-agent strip before the footer; five directory agents per page.
Sale prices and annual rents have separate filters, sorting and comparison.
Property details include the listing broker, reference, furnishing, completion, sample
availability and media request spaces.

## Honest boundaries

- Sample property/company/agent data only. Names do not assert real identities.
- Auth, Facebook/Apple sign-in, email verification, invitations and messages are simulations.
  Use verification code 246810. Do not enter actual passwords or customer details.
- No private CRM data or connection is used. No enquiry is delivered.
- No live WhatsApp number is configured; the contact preview offers a copyable broker/reference message.
- Photos are external Unsplash sample images, not a verified listing gallery.
  Internet access is required for photos. Download/replace them with owned listing assets
  and update src/data.js for self-contained/offline use.
- Map is an explicit placeholder with a neighbourhood search link.
- Legal pages are preparation notes, not production legal policies.
- Saved/recent/compare stores property IDs only in this browser.
- No server authentication, live listings API or account database is included.

## Verification

```sh
npm test
npm run check:lines
```

The source was constructed through the GitHub connector because no execution/browser
environment was available. In-memory JavaScript syntax, import, line-count and pure
catalogue checks were performed. Node/browser commands above were not executed in this
session; visual one-to-one parity has not been verified. Run them locally before use.

## Repository isolation

All reconstruction files live under websites/marketplace-rebuild on branch
website/marketplace-source-rebuild. Existing CRM source is untouched. This reconstruction
is independent of the frozen CRM browser-local demo and is not a migration into that demo.
Do not merge or deploy as a production CRM integration.

## Deployment

Serve this directory as static files. Hash routes work without server fallback rules.
This repository commit does not replace the existing Sites deployment.
