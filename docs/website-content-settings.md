# Website content settings

Implemented locally on 2026-10-29. This is the first connected CRM management packet for the websites; it uses the existing [website backend](website-backend.md). No hosting or live company data was used during verification.

## Open the controls

Use the connected CRM, following [backend setup](backend-foundation.md). The frozen browser demo does not gain these screens.

- The owning company Admin opens **Company settings → Website**, at `/#/website`.
- The Super Admin opens **Platform administration → Platform website**, at `/#/platform-website`. This always edits Blaqks One's general site, regardless of the previously selected company workspace. Its heading and top bar identify platform scope.
- Staff cannot open company content controls. A foreign or archived company scope cannot load an Admin's website editor. Backend checks remain authoritative on every request.

For initial setup, configure the general site hostname as the Super Admin, then create a company site using a name and a lowercase address name. An Admin chooses the company subdomain name, not an arbitrary custom hostname. Saving company content does not grant company website entitlement or verify listing eligibility. Those remain trusted operator setup through the existing backend controls until their management screen is built.

## Edit, review and publish

The overview separates saved public content, private draft generation, unsaved edits, configured address and listing eligibility. It does not claim DNS, SSL or deployment is active. Public website resolution requires the active site and company website entitlement; licence eligibility separately controls public profiles/listings.

Company identity includes public name, initials, service area and introduction. Four native radio choices select Signature, Modern, Editorial or Nocturne. Both site types support homepage headline/introduction, tagline, About, Services, Contact introduction and search title/description. Only selected plain text is sent; private CRM records, identity contacts, provider credentials and entitlement fields are excluded.

1. Edit the content. Empty optional fields use the website's existing default copy.
2. **Save draft** persists a private version. Visitors continue seeing published content.
3. **Review content** opens an authenticated text review with unsaved/private/published status. It is not a full rendered website preview and creates no public draft URL. Escape closes it and returns focus.
4. **Save & publish** saves the exact current form and publishes that draft. When an unchanged draft already exists, **Publish saved draft** publishes it directly. There is no separate content approval step.

Published headline/introduction appear on Home, About and Services on About, Contact introduction on Contact, and search metadata in the page head. A draft has no public effect. Public reads currently use no-store. Availability still depends on the configured backend and hosting.

Turning website visibility off hides the host. Hiding a company website also durably withdraws company-only listings; re-enabling does not automatically republish them. General-site listing participation is governed separately. These controls do not change private property records or unrelated marketplace/finance approvals.

## Conflicts and recovery

The saved draft generation and its source published version are distinct. After Publish, the inactive draft generation remains monotonic; the next edit cannot reuse an old generation. Concurrent changes return a conflict and preserve the entered form.

**Reload latest** explicitly reloads server content, asking before discarding unsaved edits. A saved draft based on an older published version cannot be published as if current. **Start from published content** asks before replacing local draft edits with the loaded public version; save the replacement to persist it. The editor never silently rebases an old draft onto a newer published version.

Network and ordinary setup errors leave fields available for correction/retry. Busy controls prevent duplicate saves, and the shared CRM guard protects route changes and browser unload while changes are unsaved. Failed public/backend requests never load sample data.

## Verification and next work

Eight focused connected browser scenarios cover draft/public separation, review, Publish and a subsequent draft generation, setup availability, conflict recovery, retry, navigation protection, staff/foreign scope and independent platform content. Existing navigation regressions also pass. Four screenshots cover 390px and 1280px in light/dark, plus keyboard theme choice, review Escape/focus return and no page overflow. These checks are not a full accessibility certification.

```bash
npm run test:server:e2e -- --browser-only website-settings- navigation.spec.js
npm test
npm run build
npm run check:i18n
npm run check:boundaries
npm run check:lines:ci
```

The browser harness creates disposable synthetic database/storage projects. The production Next.js integration also verifies published Services content on About:

```bash
npm --prefix apps/website run build
API_TEST_FILES=apps/crm/tests/api/website-next.test.mjs npm run test:api
```

Rich content blocks, logo/media editing, eligibility/custom-domain operations and production launch work remain separate. Generic platform enquiries still require the owner's recipient decision. No new migration, provider delivery or deployment is introduced by this UI packet.

## Management screens (WEB-UI2, 2026-10-30)

The Website page now has tabs; the content editor above stays as the **Content** tab and keeps unsaved drafts while other tabs are open.

- **Team** (company Admin): every live member's public profile status (Not set up, Waiting for consent, Public, Hidden), publishing permission for staff (Allow / Stop publishing, with the number of live listings that leave the website), Edit profile and Hide/Show. An Admin may correct another member's public name and specialty; only the member gives consent and chooses their public WhatsApp and email (owner, 2026-10-30).
- **Website profile** in **My profile** (Admin and staff with Properties access): public name, specialty, optional public WhatsApp and email, and the consent checkbox. Turning consent off asks first, because it takes the person's live listings off the website.
- **Properties** (company Admin; staff see their own listings in each property's panel): published listings with Live, Withdrawn and "Changes not public" states, Republish and Withdraw, and **Publish a property**. Each property's details also show a **Website** panel. Publishing is a five-step flow: property readiness, agent and destination, photos and floor plans, advertising permit and market, then a review that separates what visitors will see from what stays private.
- **Enquiries** (company Admin with Clients access): website enquiries, 50 per page, each with its message, source site and the lead it created.
- **Companies** on **Platform website** (Super Admin): every company website with its address, visibility, entitlement and licence verification, edited with a warning when turning a flag off removes listings.

Backend reads added for these screens: `GET /platform/websites/companies`, `GET /workspaces/{ws}/website/profiles`, and `destination`/`publishedAt` on the private listing list; see [website backend](website-backend.md#private-controls). Browser coverage: `website-companies`, `website-team` and `website-listings` specs alongside the settings specs.
