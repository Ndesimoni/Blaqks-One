# Keys with Simoni — remaining product and integration roadmap

Prepared **12 October 2026**, for discussion and implementation handoff to Claude Code.

**This file is a plan, not an implementation or a claim that any account is connected.** The review inspected the current repository and official provider documentation. It did not connect accounts, send messages, run migrations, change application code or verify live provider approvals. Existing uncommitted development must be preserved and reviewed by the next implementer.

## 1. What we are building

One real estate platform with a private CRM, one shared public website and a later customer mobile app. Each Admin has a private team workspace. Authorised staff can manage records, represent listings publicly, handle leads, send communications and schedule appointments within that workspace. The Super Admin oversees the teams and approves every public listing revision.

The requested capabilities are:

1. Connect business social accounts and capture supported messages, comments, enquiries and lead-form submissions.
2. Give staff a shared CRM inbox with assignments, notifications and permitted replies.
3. Send email and WhatsApp messages to individual clients and approved recipient lists; add calling in stages.
4. Monitor permitted sources for rental/purchase intent and review findings before creating leads.
5. Schedule viewings, calls and meetings from the CRM, generate meeting links and notify clients.
6. Publish approved listings from every Admin workspace on the same website, showing the actual listing agent, including eligible staff members.
7. Complete the remaining connected CRM workflows and production operations.

**Recommendation:** retain React/Vite for the CRM and Rust/Axum/PostgreSQL for the authoritative backend. Add focused backend modules and a durable worker, rather than replacing the existing system or starting with many microservices. Build the website and provider connectors as separate deliverable branches once their shared foundations exist.

## 2. Current implementation: use this baseline

The code has progressed beyond some older documentation. Inspect the current checkout before estimating work or assigning new migration numbers. The connected-feature inventory below was refreshed on 2026-10-16 against `src/features/server/sectionStatus.js` and `ServerContent.jsx`; feature presence does not establish hosted readiness.

| Area               | Present in the current source                                                                                                                                                                                                        | Still required                                                                                               |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| Identity and teams | Real sessions, Admin-owned teams, invitations, activation, granular action/resource grants, suspension/archive, self-service details/passwords and session revocation; universal company profiles and enforced Free-plan seat limits | Recovery, verified email changes, MFA, hosted sign-up hardening and subscription billing                     |
| Connected records  | Clients, Contacts, Properties, Follow-ups, Viewings, Shortlist, Interaction log and Client care; typed Deals, Payments and Expenses                                                                                                  | Server pagination, connected export and broader reporting                                                    |
| Leads              | Connected view over Clients                                                                                                                                                                                                          | External intake, attribution, assignment, qualification workflow and conversion reporting                    |
| Record safety      | Scoped CRUD, optimistic versions, linked-record checks, transactional redacted activity, assignments and assigned-only staff visibility                                                                                              | Carry those boundaries through every new feature                                                             |
| Connected screens  | Dashboard, Client desk, Performance/targets, CRM insights, Date search, Guide, My profile and Team/My activity                                                                                                                       | Broader reports, full translation and the platform Super Admin dashboard                                     |
| Language           | English/Arabic catalogues, formatters, right-to-left foundation and own-account language preference (migration 0021); currently uncommitted                                                                                          | Existing-screen translation; Arabic remains behind `VITE_I18N_PREVIEW`                                       |
| Imports            | Explicit Super Admin preview and add-only commit                                                                                                                                                                                     | Broader connected collection coverage as modules migrate; approved export/restore strategy                   |
| Team directory     | Compact directory, filters and searchable workspace components exist in the checkout; ongoing changes/tests require acceptance review                                                                                                | Verify the current work with large datasets and both themes; add database pagination when required           |
| Messaging          | Browser-demo composer/recipient search; connected message action currently reports that accounts are not connected                                                                                                                   | Real connected inbox, drafts, provider delivery, recipient consent, thread history and notifications         |
| Calendar           | Retained local Google companion and scheduling metadata                                                                                                                                                                              | Integration with real CRM membership, durable server jobs, calendar ownership and generated conference links |
| Property media     | Private record JSON currently contains small inline assets                                                                                                                                                                           | Private object storage, scanning/processing, immutable public derivatives                                    |
| Public platform    | Architecture proposal                                                                                                                                                                                                                | Public agent profiles, revision approval, catalogue, enquiries, website and mobile app                       |
| Operations         | Local Docker PostgreSQL and isolated API/browser test harness                                                                                                                                                                        | Staging/production deployment, secrets, monitoring, backups and tested recovery                              |

Source anchors:

- [Connected collections](../src/features/server/records.js), [backend collection contracts](../services/crm-api/src/records/collections.rs) and [migration 6](../services/crm-api/migrations/0006_client_workflows.sql).
- [API routes](../services/crm-api/src/routes.rs), [current permission model](../services/crm-api/src/auth/permissions.rs) and [connected message action](../src/features/server/useServerRecordActions.js).
- [Backend foundation](backend-foundation.md), [Admin-owned teams](admin-owned-teams.md), [platform design](platform-system-design.md), [messaging preview](messaging-preview.md) and [retained Calendar](google-calendar.md).

Some documentation still describes three connected collections or says scheduling and reporting screens are unimplemented. Treat those statements as documentation drift; the connected section routing, eight record collections and typed finance modules are the baseline. An existing route, navigation label or demo screen does not prove that its connected workflow is complete.

The 2026-10-16 context review ran `npm run check:lines`, which reported **37 existing oversized code files**. The 150-line rule remains mandatory for changed code. This prose plan is excluded from that limit. Previous verification reports are historical evidence, not a fresh release certificate.

## 3. What is possible, conditional and outside the initial promise

Connecting an account, receiving its inbox, collecting ad leads and searching a platform are different capabilities. OAuth login by itself grants none of the others. Each connector must advertise only capabilities demonstrated with the granted scopes and eligible business resources.

| Platform                   | Useful supported direction                                                                                               | Important limit and implementation decision                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Facebook Pages / Messenger | Page customer conversations and permitted replies; approved Page interactions; lead-ad intake as a separate access track | Page messaging needs a permitted Page token and messaging permission, with response-window rules. Plan business Pages, not a person's complete Facebook inbox. [Meta Send API](https://www.postman.com/meta/messenger-platform-api/folder/vilwbh4/send-api). Lead-form retrieval exists in the [official Meta SDK](https://github.com/facebook/facebook-python-business-sdk/blob/main/facebook_business/adobjects/leadgenform.py); lead-ad scopes, webhook fields and lead retrieval must be independently verified before that adapter is committed. |
| Instagram                  | Professional-account messages and comments, with permitted replies                                                       | Business/creator account required. Instagram Login has its own scopes and does not require a linked Facebook Page. The documented normal conversation starts with a user messaging the professional account. Consumer inbox access and unrestricted unsolicited DMs are outside the promise. [Meta Instagram collection](https://www.postman.com/meta/workspace/instagram/documentation/23987686-9386f468-7714-490f-9bfc-9442db5c8f00).                                                                                                               |
| TikTok                     | Business Messaging for authorised Business Accounts; Leads API for eligible forms and supported lead types               | Messaging access is a separate approval/onboarding gate; validate UAE/account eligibility. Ordinary developer login is insufficient. [Business Messaging setup](https://business-api.tiktok.com/portal/docs/business-messaging-api-get-started/v1.3), [messaging capabilities](https://business-api.tiktok.com/portal/bm-api/education-hub), [Leads API](https://business-api.tiktok.com/portal/docs/leads/v1.3).                                                                                                                                     |
| LinkedIn                   | Approved Lead Sync and organisation/community features                                                                   | Lead Sync is vetted access. Messages API is restricted to approved partners under an API agreement. Do not promise personal inbox sync or universal prospect search. [Lead Sync](https://learn.microsoft.com/en-us/linkedin/marketing/lead-sync/leadsync-overview?view=li-lms-2026-04), [Messages API](https://learn.microsoft.com/en-us/linkedin/shared/integrations/communications/messages).                                                                                                                                                       |
| YouTube                    | Eligible channel comments, replies and public video/channel discovery                                                    | Build a comments/source-intelligence connector; a general customer DM inbox is not established by the reviewed Data API. Video search does not discover everyone's housing requirements, and commenters' email/phone are not guaranteed. Quotas apply. [Comment threads](https://developers.google.com/youtube/v3/docs/commentThreads/list), [search](https://developers.google.com/youtube/v3/docs/search/list), [quota overview](https://developers.google.com/youtube/v3/getting-started).                                                         |
| Snapchat                   | Lead-generation ad forms/webhooks and eligible public-profile data                                                       | The documented messaging API concerns brand–creator collaboration; it is not evidence of access to ordinary customer Snapchat DMs. Start with lead forms, not a promised universal inbox. [Lead generation](https://developers.snap.com/marketing-api/Ads-API/lead-generation-ads), [collaboration messaging](https://developers.snap.com/marketing-api/Public-Profile-API/Messaging).                                                                                                                                                                |
| X / Twitter                | Authorised DMs, mentions and permitted public keyword search/filtered stream                                             | Paid usage and limits must be budgeted. DM access and search have separate authorisation requirements; recipient settings and platform rules still apply. [X API](https://docs.x.com/x-api/introduction), [DM management](https://docs.x.com/x-api/direct-messages/manage/introduction), [filtered stream](https://docs.x.com/x-api/posts/filtered-stream/introduction).                                                                                                                                                                              |

Instagram is included because it was part of the earlier requested social scope and shares a useful Meta integration path. It can be deferred if the business no longer needs it.

For every platform, the product should show one of: **Not configured, Access pending, Connected with supported capabilities, Reconnect required, Rate limited, Paused, or Unsupported capability**. Never display a working inbox merely because the account name was retrieved.

### Practical limits to discuss

- We can receive supported events for authorised resources. We cannot guarantee every like, follower, private DM or historical conversation on every network.
- A comment, like or keyword match is an interaction signal. It is not proof of buying intent or permission to contact someone through another channel.
- Public social handles do not automatically provide verified phone numbers or email addresses.
- No plan should rely on copied browser sessions, account passwords, private-page scraping or a provider's research access being repurposed for commercial prospecting.
- TikTok explicitly excludes advertisers/commercial users from its Research Tools. That route is unsuitable for this CRM's public keyword prospecting. [TikTok Research FAQ](https://developers.tiktok.com/docs/en/research-api-faq?enter_method=left_navigation).
- If an API capability is unavailable, use a native-platform link, approved lead form, tracked website link or manual review/import. Identify the fallback accurately; it does not provide hidden inbox synchronisation.

## 4. Ownership: Admin workspace and individual listing agents

The new requirement extends the older platform proposal, which defaulted the public agent to the workspace owner.

**An Admin owns the workspace. A staff member can be the public listing agent. These are separate identities.** The same rule applies to a manager, marketer, consultant or coworker who has the necessary grants and professional eligibility.

Example:

| Record/action                              | Owner workspace            | Actual actor   | Public listing agent                 | Enquiry assignee            |
| ------------------------------------------ | -------------------------- | -------------- | ------------------------------------ | --------------------------- |
| Manager creates Listing A                  | Admin A                    | Manager A      | Manager A                            | Manager A by default        |
| Marketer creates Listing B with permission | Admin A                    | Marketer A     | Marketer A, if eligible and approved | Marketer A by default       |
| Coordinator edits Listing A photos         | Admin A                    | Coordinator A  | Manager A remains displayed          | Existing assignment remains |
| Super Admin approves Listing B             | Admin A                    | Super Admin    | Marketer A                           | No ownership transfer       |
| Customer enquires about Listing B          | Admin A, derived by server | Public visitor | Approved Marketer A profile          | Marketer A or Admin A queue |

Keep these concepts separate in the data model:

- **Workspace:** private tenant/team boundary; preserve existing workspace identifiers.
- **Creator and actor:** who created a record and who performed each later action.
- **Property manager/assigned staff:** who can maintain or handle the private property workflow.
- **Public listing agent:** the professional customer-facing representative in the approved revision.
- **Enquiry/conversation assignee:** who must respond, with assignment history.
- **Provider connection/resource owner:** which workspace controls a Page, mailbox, business number or calendar.

Workspace ownership transfer is not currently implemented or authorised by this roadmap; it would require a separate migration and preservation review. Changing a listing agent does not change the workspace owner.

All referenced staff must be active members of the same workspace. A role label alone does not establish public-agent eligibility. A marketer may prepare a listing while another eligible agent is its public representative. Define which professional credentials and company approvals are needed before permitting representation.

Recommended first version: **one canonical public listing per private property, with one primary agent and optional internal collaborators**. Avoid duplicate website entries merely because two coworkers promote the same property. If true co-listing or separate mandates are later required, model them explicitly with duplicate detection and separate approval; do not copy the whole private record into each person's account.

Existing enquiries keep their original workspace and historical listing/agent attribution when a property's agent changes. Reassignment within that team is explicit and audited. A removed staff member's unresolved enquiries go to the Admin queue; records remain company property. Changing a public agent or contact requires a new approved revision.

## 5. Permissions to add before external delivery

Current module booleans are not enough for individual mailboxes, staff-only assignments and public publication actions. Preserve existing grants during an additive migration; new sensitive capabilities default to denied for staff. Positions suggest defaults, while Admins review explicit grants.

| Capability                                   | Super Admin                                     | Admin                            | Authorised staff                                                                 |
| -------------------------------------------- | ----------------------------------------------- | -------------------------------- | -------------------------------------------------------------------------------- |
| Create Admin accounts                        | Yes, through controlled commands                | No                               | No                                                                               |
| Invite/manage staff                          | Across permitted teams                          | Own team                         | No; team-management delegation is a separate future decision                     |
| Read/edit CRM data                           | Across teams                                    | Own team                         | Assigned records or whole permitted team collection, according to explicit scope |
| Connect/disconnect shared business resources | Across permitted teams, with provider authority | Own team's authorised resources  | Only explicit connection-management delegation                                   |
| Read conversations                           | Authorised business resources across teams      | Own permitted business resources | Assigned or team scope plus resource grant                                       |
| Reply/send email or WhatsApp                 | Explicit authorised sender resource             | Own permitted sender resource    | Channel + sender-resource + record/conversation grant                            |
| Bulk campaigns                               | Explicit campaign authority                     | Separate grant/policy            | Separate bulk-send grant; never implied by reply permission                      |
| Create/edit listing drafts                   | Permitted teams                                 | Own workspace                    | Separate create/edit scope                                                       |
| Represent a listing publicly                 | Eligible approved profile                       | Eligible approved profile        | Eligible approved profile plus representation grant                              |
| Submit listing for publication               | Permitted teams                                 | Own workspace                    | Explicit submission grant                                                        |
| Approve publication                          | **Super Admin only**                            | No                               | No                                                                               |
| Withdraw a listing                           | Across teams                                    | Own workspace                    | Explicit withdrawal grant/scope                                                  |
| Monitor keywords / review signals            | Scoped oversight                                | Own rules/queue                  | Explicit monitoring/review grant                                                 |
| Schedule on a calendar                       | Authorised delegated calendars                  | Own permitted calendars          | Schedule + calendar-resource authority                                           |
| Export messages/contacts                     | Separate restricted export grant                | Separate restricted export grant | Separate restricted export grant                                                 |

Separate read, create, edit, delete, assign, submit and approve actions where the workflow needs them. Enforce the same scope in search, counts, notification previews, exports, links, attachments and APIs. Assigned-only staff must not learn hidden records through result totals or recipient suggestions.

**Super Admin oversight does not mean silently importing an employee's entire personal mailbox.** Recommend connecting business mailboxes and documenting which business conversations are visible to supervisors. Personal mail should remain outside the product by default. Delegated sending must be authorised by the provider; an Admin cannot use a staff member's email address merely by typing it into a From field.

## 6. Proposed system boundaries

| Component                 | Responsibility                                                                                                   |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Private CRM frontend      | Scoped workflows, inbox, connections, monitoring, schedules, publication drafts/reviews and reports              |
| Existing Rust API         | Authentication, workspace/action/resource checks, commands, validation and authoritative records                 |
| Provider adapters         | OAuth/token refresh, capability checks, event normalisation and channel-specific delivery rules                  |
| Webhook intake            | Verify provider authenticity, persist receipts, reject forged/replayed events and acknowledge durable acceptance |
| Durable worker            | Process receipts, outbox sends, media, reminders, indexing and reconciliation with retry/recovery                |
| PostgreSQL                | Business records, assignments, conversations, revisions, provider metadata, durable jobs and redacted audit      |
| Private object storage    | Upload staging, protected documents/originals and restricted message attachments                                 |
| Public catalogue API      | Explicit approved listing/agent projections; no private CRM serialisation                                        |
| Shared website            | Crawlable search/details/agent pages and enquiries from every eligible workspace                                 |
| Later customer mobile app | Reuse public catalogue and enquiry contracts; no CRM privileges                                                  |

Flows:

- Provider event → verified receipt → durable processing → permitted team inbox/intake → assignment → staff notification.
- CRM send → authoritative permission/policy check → message + outbox transaction → worker recheck → provider request → evidenced status.
- Property draft → processed media + approved agent profile → immutable revision → Super Admin approval → eligible public projection → website.
- Website enquiry → trusted publication lookup → immutable destination workspace → durable enquiry → client/lead link → assignment/notification.

Start with PostgreSQL-backed durable jobs/outbox and a separately runnable worker. Add another queue system only when measured throughput or hosting constraints justify it. Webhooks require a reachable HTTPS endpoint; the present localhost development setup alone cannot receive production callbacks.

### Suggested future module locations

Keep the current project structure. Add focused modules under `services/crm-api/src/` for integrations, inbox, intake, assignments, scheduling, media, publications, public catalogue and notifications. Use feature folders in `src/features/` with separate services/hooks/models, and `src/services/crm/` for API contracts.

A future public website can live in an isolated `apps/public-web/` package. A rendered React framework such as Next.js is a reasonable candidate, while retaining Rust as the authoritative API. Framework and hosting selection remain decisions. [Next.js server/client rendering](https://nextjs.org/docs/app/getting-started/server-and-client-components).

Do not restructure every existing file or switch the CRM framework as a prerequisite. Shared packages should contain only deliberately shared design tokens, public contracts and utilities, never private secrets or server-only data models.

## 7. Data and API planning contracts

These are proposed responsibilities, not SQL, endpoint implementations or fixed migration numbers.

| Entity/module                | Key information and invariant                                                                                                                 |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Provider connection          | Workspace, connecting member, provider account/resource IDs, scopes, capabilities, encrypted credential reference, lifecycle and health       |
| Resource grants              | Members allowed to read, send or manage a specific mailbox, Page, number or calendar; independent of job label                                |
| External identity            | Provider + connection/resource + external identity ID; optional verified CRM link; no cross-workspace deduplication                           |
| Webhook receipt              | Provider/event identifier, verification evidence, receipt time, processing state and bounded encrypted raw payload retention                  |
| Conversation                 | Workspace, resource/channel, external thread ID, participants, assignee, state and permitted client/lead links                                |
| Message                      | Direction, channel, sender resource, actor, external ID, protected body/attachments, policy evidence and delivery history                     |
| Intake/enquiry               | Immutable original source, destination workspace, form/listing/revision IDs, campaign attribution, supplied contacts and qualification state  |
| Assignment                   | Record/conversation, active same-team assignee, assigning actor, reason and history                                                           |
| Consent/suppression          | Contact, channel, purpose, evidence/time, withdrawal and restrictions; checked when queued and when sent                                      |
| Monitoring rule/signal       | Permitted source, terms, location/language, cursor/budget, match evidence, review result and optional lead link                               |
| Appointment                  | Workspace, organiser/calendar resource, linked client/property/activity, timezone, provider event ID, conference state and notification state |
| Public agent profile/version | Member/workspace, approved professional display data and intentional business contacts; separate from login/member profile                    |
| Listing/revision/publication | Stable listing ID, private property link, frozen public payload/media/profile version, reviewer, eligibility and activation state             |
| Media asset                  | Workspace, uploader, protected original, processing/scan state, immutable derivatives and explicit publication usage                          |
| Job/outbox                   | Operation key, payload reference, workspace/resource/actor, lease, retries, next attempt and failure/reconciliation state                     |
| Notification                 | Workspace/member recipient, authorised target, unread/read state and deduplication key                                                        |

Message bodies belong in protected conversation storage, not append-only activity. Audit records capture actor, scope, action, object IDs and time without tokens, passwords, full recipient addresses or message content. Apply appropriate retention to both business content and provider payloads.

Future API contracts should cover connection authorisation/callbacks, capability/resource lists, connection health, inbox queries, assignment, replies, campaign previews, consent, monitoring, appointments, upload processing, revision submission/review, publication withdrawal and public enquiries. Keep public endpoints separate from private `/api/crm` commands. Every client-supplied record, member, workspace and connection identifier requires server validation.

Preserve Clients as the canonical client/lead relationship. Create an intake record or external identity when a social user has no real phone/email; do not invent contact details or a placeholder verified identity to satisfy a form. Link to Clients when there is enough validated information, and retain the original intake evidence. Update connected validation and workbook adapters carefully if contactless leads become supported.

## 8. Shared inbox and lead capture

### Staff journey

1. Admin connects an eligible business resource and grants staff access.
2. A verified inbound event enters that resource's workspace inbox.
3. The system links an existing same-workspace conversation/client or creates an unqualified intake item.
4. Assignment rules send it to the listed agent, designated staff member or Admin queue.
5. The staff member sees the original channel/source, qualifies requirements, adds a follow-up and replies using an allowed sender.
6. The history records actual provider status and staff activity. The Admin sees their team; Super Admin sees authorised business activity across teams.

Use conversation states such as New, Open, Waiting for client, Resolved and Spam, distinct from lead stages. Show unread counts, owner/assignee, last activity, channel, response due time and connection health. Private internal notes must never be delivered to clients.

Notifications start with an in-app unread centre and authorised real-time updates or modest polling. Email/push alerts are later channels. Recheck permissions when opening a notification and minimise lock-screen/browser preview content.

### Lead rules

- A lead form or explicit property enquiry can create a lead automatically once validated. A bare like/follow is a signal or aggregate metric.
- A DM showing rental/purchase intent can enter qualification automatically or require review under a workspace rule. Do not classify every support/spam conversation as a sales lead.
- Retain first source, later touchpoints, campaign/form/post/listing IDs and available UTM attribution. Do not replace historical source whenever a new message arrives.
- Deduplicate provider event IDs and conversation IDs separately from contact matching. Shared/changed telephone numbers and names alone are not enough for automatic merges.
- A social handle is not a verified identity across TikTok, Instagram and X. Merge only with reliable evidence or explicit staff review.
- Same person contacting Admin A and Admin B has separate private relationships in each workspace.

### Shared company accounts

One Facebook Page or WhatsApp number cannot be independently attached to multiple Admins with competing ownership. Use one canonical resource registration.

For a shared organisation resource, route by a trusted campaign/form-to-workspace mapping or a signed listing/referral context. An account-specific provider ID does not inherently reveal which Admin should receive a message. Ambiguous enquiries enter a restricted organisation triage queue. Super Admin assigns them explicitly; do not broadcast private messages to all Admins.

After initial routing, store the destination. Configuration changes must not silently move old conversations. A contact writing about two different teams on the same shared thread requires explicit triage and a disclosure-safe workflow; avoid exposing the entire thread to both teams by default.

## 9. Email, WhatsApp and calls

### Email

Support two distinct delivery modes:

- **Business member mailbox:** OAuth connection to Gmail/Google Workspace or Microsoft 365/Outlook; messages sent through that authorised account.
- **Agency transactional sender:** verified agency domain for invitations, system notifications and optionally approved campaigns. This does not grant access to a staff mailbox.

Start with one-to-one sending, then replies/inbox synchronisation, then bulk campaigns. Gmail send-only permission is different from restricted mailbox-read scopes; broader inbox access can require additional verification/security assessment depending on deployment and data handling. Budget that as an external gate. [Gmail scopes](https://developers.google.com/workspace/gmail/api/auth/scopes). Gmail inbox updates use Pub/Sub notifications plus subsequent mailbox history processing; notifications alone are not the email content. [Gmail push guide](https://developers.google.com/gmail/api/guides/push).

Microsoft Graph supports mailbox sending, but `202 Accepted` does not establish completed processing or delivery. [Graph sendMail](https://learn.microsoft.com/en-us/graph/api/user-sendmail?view=graph-rest-1.0). Preserve honest status labels across providers.

Requirements: correct From/reply identity, approved aliases/delegation, threading, MIME/HTML sanitisation, attachment limits, bounce handling, suppression/unsubscribe, domain authentication for an agency sender, and appropriate account/provider send budgets. A multi-recipient campaign should create individual sends rather than revealing unrelated client addresses in To/CC. Avoid claiming email read receipts as reliable universal proof.

### WhatsApp

Use the official Business Platform, directly or through an authorised provider. Decide who owns the business number and whether each team needs its own number. A staff member's phone field is contact information; it does not turn that phone into a programmable WhatsApp sender.

Meta requires contact details and opt-in permission for subsequent contact, approved templates to initiate conversations, and templates outside the 24-hour customer-service window. Honour opt-outs and use the right template purpose. [Current WhatsApp policy](https://whatsappbusiness.com/policy/). Validate number onboarding, coexistence/migration eligibility, approved templates and applicable charging rules with the selected account before promising continuity of an existing app number.

Product work: channel-specific composer, template selection/variables, per-recipient eligibility preview, separate message jobs, delivery/read events where available, attachments, opt-out controls, spending/rate budgets and clear failures. A `wa.me` link opens an external app; it is not CRM delivery or inbound sync.

### Calling: three separate levels

| Level                | Experience                                                                                | Delivery scope                                                                                                                                                                                                                                                            |
| -------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1 — assisted call    | Click phone link, use the user's dialler and manually log outcome                         | Fast first release; no automatic claim that a call connected                                                                                                                                                                                                              |
| 2 — CRM telephony    | Browser/click-to-call with an eligible telephony provider, company number and call events | Separate provider selection, UAE availability and operating-rule review                                                                                                                                                                                                   |
| 3 — WhatsApp calling | Business voice within supported WhatsApp journeys                                         | Calling API exists, including permission-based outbound calls, but requires a separate account/number/country eligibility proof. It is not ordinary phone calling. [Official Calling API announcement](https://whatsappbusiness.com/blog/whatsapp-business-calling-api/). |

Start with level 1. Later telephony needs authorised caller identity, connection status, missed-call routing, call logs, outcome/follow-up and cost controls. Recording/transcription require a separate business/privacy decision; exclude them from the initial calling release. Do not promise generic API access to mobile calls or social-platform voice/video calls.

UAE marketing communications need an operating policy covering permissible contact, suppression/DNCR, business numbers and relevant timing requirements. Have the applicable rules reviewed for the company's jurisdiction and use case before marketing/calling activation; implement the resulting policy as server-side configuration. The UAE government publishes [telemarketing regulations](https://uaelegislation.gov.ae/en/legislations/2519/download) and [data-protection guidance](https://u.ae/en/about-the-uae/digital-uae/data/data-protection-laws.). This plan does not establish legal eligibility or invent an automated DNCR API.

## 10. Keyword monitoring and property-intent qualification

Build **Monitoring → Signals → Review → Lead**, rather than a tool that automatically scrapes people and messages them.

First sources: authorised owned-account messages/comments, website enquiries and lead forms. Add X public search/stream only after a budgeted access proof. YouTube can supply permitted video/comment discovery. Broad Facebook/Instagram/LinkedIn/Snapchat/TikTok prospect search is outside the initial promise unless a specific approved API or licensed provider demonstrably supports the use case and permitted downstream use.

Rules should combine intent phrases, geography, property facts, language, exclusions, source scope and maximum age. Examples for human review:

| Rule                 | Positive signals                                                                   | Exclusions / ambiguity                                                           |
| -------------------- | ---------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Residential rental   | Looking to rent, need a studio, family apartment, community/emirate, bedroom count | Property adverts saying “for rent”, agents offering inventory, job/spam posts    |
| Residential purchase | Looking to buy, budget, preferred area, finance/cash timeframe                     | General market discussion without an enquiry                                     |
| Off-plan / primary   | Off-plan, developer project, launch, payment plan, handover                        | Developer promotional content and unrelated “plan” text                          |
| Secondary / resale   | Resale, ready unit, secondary market, buyer requirements                           | Treat readiness and transaction market as different fields                       |
| Commercial property  | Office/shop/warehouse rental or purchase, area and business use                    | Buying an operating business is a different product from buying/renting premises |

Use independent dimensions: purpose (sale/rent/holiday), asset class (residential/commercial), property subtype, development status (ready/off-plan), transaction market (primary/developer or secondary/resale), location, budget/currency/basis, size, timing and preferred contact. “Off-plan” and “primary” must not be treated as identical. Store unknown values as unknown.

Implement explainable keyword/rule matching first: show matched phrases, source URL, time and why it was flagged. Optional later AI classification must return evidence/confidence, support English/Arabic, recognise negation and distinguish buyer requests from adverts. Treat imported content as untrusted data, never executable instructions. Do not send business conversations to an AI provider without a separate data-handling decision.

Reviewers can dismiss, mark duplicate/spam, request details or convert to a lead with an explicit assignee. Conversion does not grant contact permission. Preserve the source and review decision. Define deletion/expiry behaviour for provider content and avoid retaining more than the provider terms allow. Track precision and qualified-lead conversion; raw keyword-hit counts are not sales performance.

## 11. Scheduling and meeting links

Recommend Google Calendar + Google Meet first, with Microsoft Outlook + Teams as a later adapter if used by the team. The retained loopback companion is reference material: migrate useful validation/retry behaviour into authenticated connected modules, rather than exposing its local session model publicly.

The CRM appointment links to a permitted client/property/follow-up/viewing and an authorised organiser/calendar. Show date/time, duration, timezone, location, participants, invitation option and reminder preference. Default to `Asia/Dubai`, while storing UTC instants and IANA timezone for international clients. Date-only follow-ups remain date-only tasks unless explicitly scheduled.

Google Calendar supports conference creation and attendee notifications; conference generation can be asynchronous, so show link pending until confirmed. [Google event/conference guide](https://developers.google.com/workspace/calendar/api/guides/create-events). Use provider event identity and request idempotency to reconcile retries; use unique conference details for separate client meetings. [Events insert reference](https://developers.google.com/workspace/calendar/api/v3/reference/events/insert). Microsoft calendar events support online-meeting fields where the calendar/account permits them. [Graph create event](https://learn.microsoft.com/en-us/graph/api/user-post-events?view=graph-rest-1.0).

Recommended flow: save appointment → queue provider event/conference → confirm link → send the selected invitation/reminder channel. Event state, link state and client-notification state are independent. A saved appointment is not proof the client was notified. Avoid duplicate invitation emails when the calendar already sends invitations and the CRM separately sends a reminder.

Include reschedule/cancellation, client response where available, conflict/free-busy checks, retry, reconnect and per-person delegation. First release is CRM-managed events flowing outward; two-way calendar editing, recurrence and public self-booking are later tasks. Preserve unrelated personal calendar events. An organiser losing access must trigger triage/reassignment, not silent use of their token or automatic email to every attendee.

## 12. Shared website, public agents and approval

### Publication workflow

1. Eligible staff creates/edits a private property in their Admin workspace.
2. They prepare public fields, processed media, availability, business contact and eligible listing agent.
3. Submission freezes the exact revision, including agent-profile/contact and media versions.
4. Super Admin previews it and approves or rejects with a reason.
5. The publication service rechecks workspace/member eligibility and activates only that approved revision.
6. Public edits require another submission. Owner/authorised staff can withdraw; Super Admin can withdraw any listing.

States: Draft, Submitted, Changes requested/Rejected, Approved awaiting activation, Published, Withdrawn, Expired/Suspended. Property business status such as Available, Reserved, Sold or Rented is separate.

Approval is not a boolean on a mutable property record. Public pages must not change because a staff member edits an approved image, contact profile or description in place. Freeze immutable public versions. Require a new revision for public-agent reassignment. Recheck current eligibility when approving and publishing, including queued operations.

Recommended policy: an accurate eligible old revision can stay live while ordinary improvements are reviewed. Withdraw an inaccurate or ineligible version promptly, including unavailable property or suspended representative, until a valid revision is approved. Archiving/suspending an Admin removes their eligible public availability; do not delete historical company records or reroute their enquiries to another Admin automatically.

Publication jobs must match the current approved revision and expected publication state/version before activation. Withdrawal advances that state so a delayed old job cannot republish it. Set and test a documented maximum takedown interval across the public API, search, listing/agent pages, sitemaps and controlled CDN caches. Origin enquiry validation rejects ineligible listings immediately, even if a stale page remains cached. Previously downloaded media and third-party copies cannot be recalled.

### Public data contract

Allow only approved display fields: title/description, purpose/type, appropriate location precision, price/currency/basis, facts, amenities, approved media/floor plans, permitted professional credentials and an approved public agent profile/contact version.

Exclude landlord identity/contact, private client details, unit/access instructions, internal notes, finance/margins, private documents, original uploads, team/member settings, login email, assignments and tokens. Never expose the Properties JSON and rely on the browser to hide fields. The existing mixed photo/document URL needs explicit separation before public use.

The same website contains all approved eligible workspaces, with filters and individual agent pages. A manager and marketer under Admin A can have different approved profiles/listings; neither receives a separate tenant just to appear publicly. Admin B's published listings are visible publicly, while Admin B's private CRM stays isolated.

### Website release pages

Home/search, listing results, property details/gallery, agent profile and their active listings, contact/enquiry, company information, privacy/marketing preferences and useful unavailable/not-found pages. Use stable crawlable URLs, rendered listing content, canonical links, sitemap updates and sensible structured data. Do not use private CRM hash routes as public listing URLs.

Filters: sale/rent/holiday, residential/commercial, subtype, emirate/community, bedrooms, price range and basis, readiness, primary/secondary and agent where useful. Keep annual rent, nightly rates and sale prices distinct. Preserve brand/design standards, accessibility, mobile contact actions and clear demo-photo labels in nonproduction fixtures. Discuss Arabic/English support before finalising public content fields.

### Enquiry routing

The visitor submits listing ID/revision, name, usable reply contact, message and preferred channel. The server resolves the workspace and agent from the publication; the visitor cannot supply the receiving workspace or internal assignee.

Store a durable idempotent enquiry before reporting success. Notify the agent asynchronously and link/qualify the lead within the original workspace. Recheck availability at submission and reject new enquiries for withdrawn, ineligible or archived listings. Never silently send them to another team. If an otherwise eligible listing's assigned agent is unavailable, use that team's authorised Admin queue while preserving attribution. Restricted Super Admin triage is for already accepted enquiries or later provider events whose destination has become unavailable; it does not bypass publication eligibility, write into a frozen workspace or transfer historical records.

Email/WhatsApp/call links display approved professional contacts. A click is an intent event, not evidence of delivery. Prefer the form or trackable approved provider channel for reliable CRM intake. Add anti-spam/rate controls, bounded input, safe notification content and separate optional marketing preferences.

## 13. Reliability, security and departure rules

- Bind OAuth state to the authenticated member, selected workspace, provider and intended resource. Use PKCE where supported, exact redirect validation, single use and expiry; validate granted account/resources before storing a connection.
- Keep credentials encrypted server-side with managed keys and rotation/revocation. Never use Vite variables, local storage, URLs, frontend logs or activity for tokens.
- Verify each provider's documented webhook mechanism. Providers differ; do not assume every platform signs requests the same way. Authenticate Pub/Sub push separately where used.
- Persist valid receipt before acknowledgement. Deduplicate by stable provider/resource/event identity. Handle out-of-order edits/statuses, reconnect gaps and permitted backfill.
- Workers recheck active workspace, actor authority, assignee/resource grants, current policy and consent before external effects. A job accepted before suspension is not continuing authority to send.
- Suspend/archive/disconnect must invalidate pending work safely. External effects already accepted cannot always be recalled; represent in-flight or uncertain results honestly.
- Outbound retries are not universally exactly-once. If a provider accepted a send but the response was lost, reconcile using supported IDs/history/idempotency. Where that cannot be established, show **Outcome unknown — review required** rather than blindly resending.
- Use retry budgets/backoff, per-resource rate/spend limits, durable leases, dead-letter/reconciliation queues and operator tools that preserve original scope.
- Protect attachment downloads with live access checks, bounded sizes and safe content handling. Sanitise rich text; do not auto-fetch arbitrary user URLs without restricted network access.
- Archival retention is not an exemption from provider deletion requirements or valid privacy obligations. Support scoped export/deletion requests and retention policies for integration data without introducing hard deletion of CRM accounts by accident.

Departure defaults:

| Event                                     | Recommended behaviour                                                                                                                                           |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Staff suspended/archived                  | Block login/sends, remove resource grants, triage pending jobs and unresolved assignments; retain company records and historical attribution                    |
| Public agent becomes ineligible           | Withdraw affected public availability/contact promptly; require approved replacement agent revision                                                             |
| Admin suspended                           | Pause that team's external sends and public eligibility; preserve records; route incoming events only according to an explicit restricted recovery policy       |
| Admin archived                            | Freeze CRM/business workflow, stop public enquiry intake to that team, quarantine later provider events for restricted triage or discard under retention policy |
| Shared business connection disconnected   | Stop sends/sync and revoke where possible; retain allowed business history; show reconnect requirements                                                         |
| Staff-owned mailbox/calendar disconnected | Do not transfer the credential to another person; arrange provider-authorised delegation/reassignment                                                           |

Super Admin sees business status, assignments, approvals and audit through authorised views. No password/token display and no unnecessary exposure of unrelated personal provider data.

## 14. Implementation phases for Claude Code

Each phase is a series of small reviewable changes with migrations, UI, failure states and tests. External approvals run in parallel where possible. The website does **not** wait for every social adapter or finance screen.

| Phase                                   | Deliverable                                                                                                                                                              | Dependencies                                                                              | Completion evidence                                                                                                            |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| P0 — baseline and decisions             | Inspect current branch/diff, reproduce existing tests, accept ongoing Team/workflow changes, resolve documentation drift and record business decisions                   | None                                                                                      | Implemented/incomplete inventory; preservation checks; agreed boundaries and scoped backlog                                    |
| P1 — assignments and granular access    | Same-workspace assignments, action/resource grants, eligible public-agent identity, team/assigned visibility                                                             | P0                                                                                        | Cross-workspace/ID tampering denied; assigned-only lists/counts/exports safe; role labels cannot escalate privileges           |
| P2 — reliable integration foundation    | Connection lifecycle, credentials/resource registry, receipt/outbox/jobs, provider-independent intake/conversation kernel, consent/suppression and notification skeleton | P1                                                                                        | Durable restart/retry, forged events rejected, duplicate events do not duplicate records, revoked access stops sends           |
| P3 — inbox and first live communication | Conversation/intake/draft UI, one selected business email provider, single-client send/reply, assignment and activity                                                    | P2                                                                                        | Sandbox inbound → correct team → client link → reply → provider evidence; failed/unknown sends shown correctly                 |
| P4 — WhatsApp and client communications | Business number onboarding, permitted send/receive, templates, client shortcuts, controlled bulk sends, assisted call logging                                            | P2 + shared inbox UI (M1), plus account eligibility; live email approval is independent   | Consent/window checks, no recipient leakage, per-recipient outcomes, actual sandbox delivery and inbound callback              |
| P5 — connected schedules                | Authenticated Google calendar connection, CRM-managed event sync, unique Meet link and client invitation/reminder                                                        | P2; messaging channel for optional reminders                                              | Idempotent save/update/cancel, correct timezone, pending link handled, no duplicate notifications, staff departure tested      |
| P6 — public listing foundation          | Private processed media, public profiles, immutable listing revisions, Super Admin review, catalogue/enquiry API                                                         | P1 + P2 durable jobs/intake                                                               | No unapproved revision leaks, same-team agent checks, private documents inaccessible, withdrawals and trusted routing verified |
| P7 — shared website launch              | Rendered public search/details/agent pages, enquiry form, approved contact links, SEO/cache/takedown rules                                                               | P6                                                                                        | Manager/marketer/Admin A/B scenarios, guest enquiry persists, routing correct, responsive pages and private-field tests pass   |
| P8 — social adapters                    | Meta Page/Instagram first; then eligible TikTok, LinkedIn lead sync, YouTube comments, Snapchat lead forms and X                                                         | P2 + shared inbox UI (M1); each provider access proof; live email approval is independent | Separate capabilities/approval record and end-to-end evidence for each shipped feature; unsupported features stay disabled     |
| P9 — monitoring and attribution         | Owned-source rule matching, review queue, qualified conversion; budgeted permitted public search later                                                                   | Intake + supported adapters                                                               | Noise/duplicate/negation scenarios, provenance retained, no unsolicited auto-contact, measurable qualification precision       |
| P10 — CRM completion and operations     | Remaining modules, reports/exports/activity, performance, recovery/MFA, pagination, deployment/backup/monitoring                                                         | Incremental; production gates before any public launch                                    | Complete connected flows, restore drill, least-privilege deployment, operational alerts and rollout/rollback evidence          |
| P11 — customer mobile and extensions    | Shared catalogue/enquiries on mobile, optional customer accounts/favourites/push; later scheduling/calling/automation extensions                                         | Stable public contracts and production operations                                         | Customer identity cannot gain CRM access; same approval/enquiry rules; store/platform release checks                           |

P2 includes provider-independent intake and conversation contracts; P3 delivers their staff-facing inbox UI and a separate first email adapter. WhatsApp/social packets depend on the shared inbox kernel/UI, not approval of that email adapter. P6/P7 can run alongside P3–P5 once P1/P2 are stable. Production requirements from P10 are a prerequisite to a hosted release, even if remaining finance modules ship later. The phases are dependency order, not calendar-date promises; estimate from the validated backlog and staffing. Provider review time and operating cost are separate from engineering effort.

### Concrete work packets

| Packet | Scope for one implementation/review cycle  | Definition of done                                                                                                                                                                                          |
| ------ | ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A1     | Assignment model and member eligibility    | **Done (2026-10-12, migration 8):** see [Assignments design](assignments-design.md); same-team commands, history and Admin queue fallback tested                                                            |
| A2     | Action/resource permissions                | **Done (2026-10-13, migration 9):** see [Action permissions design](action-permissions-design.md); server checks, Team form, deny-by-default new grants, unchanged existing access, permission matrix tests |
| I1     | Connection registry and one OAuth provider | Correct workspace binding, authorised resource selection, encrypted tokens, reconnect/disconnect and redacted audit                                                                                         |
| I2     | Receipt/outbox worker                      | Durable transactions/leases, signature verification, dedupe, restart recovery, scoped retry and unknown-outcome handling                                                                                    |
| M1     | Inbox UI and real drafts                   | Searchable conversations, assignment, unread state, isolated internal notes, safe attachments and protected draft navigation                                                                                |
| M2     | Email send/reply adapter                   | Verified authorised sender, thread identity, explicit provider statuses, restricted mailbox scope plan and sandbox proof                                                                                    |
| M3     | WhatsApp adapter                           | Account/number proof, eligible individual sends, inbound callbacks and template/consent policy                                                                                                              |
| M4     | Bulk campaign workflow                     | Audience review, separate grant, dedupe/suppression, per-recipient jobs, partial failure and spend limits                                                                                                   |
| S1     | Calendar resource + appointment sync       | Connected identity replaces local companion trust; linked records scoped; stable provider event reconciliation                                                                                              |
| S2     | Conference/invitations                     | Unique link per meeting, link-pending recovery, selected client notification, reschedule/cancel and permission revocation                                                                                   |
| W1     | Private media processing                   | Protected uploads, type/size validation, scan/re-encode/metadata controls and safe immutable derivatives                                                                                                    |
| W2     | Public agent/revision/approval             | Staff profiles separate from login; exact-version review; Super-only approval; no automatic approval bypass                                                                                                 |
| W3     | Catalogue/enquiry backend                  | Public allowlist, active eligibility, trusted agent/workspace routing, spam controls and durable receipt                                                                                                    |
| W4     | Public website                             | Search/details/agents, forms, contact attribution, availability pages and cache/SEO/mobile verification                                                                                                     |
| C1–C7  | One social provider per packet             | Capability spike first; eligible scopes/account; verified events; inbox/lead mapping; policies, limits and live sandbox proof                                                                               |
| L1     | Monitoring review workflow                 | Owned-source matching and evidence; conversion to Clients without fabricated contact identity                                                                                                               |
| O1     | Hosted operational readiness               | Staging secrets/HTTPS, provider callbacks, worker monitoring, backups/restore and rollback                                                                                                                  |

The [public website plan](public-website-plan.md) replaces W1–W4 with packets WEB1–WEB9, adding the design packet and company websites.

Split any packet further if it crosses too many contracts. Do not ship empty connected screens as completed integrations. A mocked provider test proves application handling; it does not establish provider approval or live delivery.

## 15. Remaining connected CRM work outside the integrations

- **Deals, Payments and Expenses:** server-backed workflows with same-workspace client/property links, safe monetary precision and status rules; define commissions, splits, VAT treatment and reporting before implementing calculations. ~~Enforce the existing optional referred-client relationship within the same workspace during current workflow hardening.~~ **Done (2026-10-12, migration 7):** Clients `referred_by_client_id` and Client care `referred_client_id` are same-workspace foreign keys, self-referral is rejected, and create/edit return a link-specific `link_missing` message. ~~Enforce the optional deal relationship (Interaction log `deal_id_optional`) when Deals becomes connected.~~ **Done (2026-10-15, migration 16):** connected Deals, Payments and Expenses use typed finance tables per [Finance design](finance-design.md), and the Interaction log deal link is enforced under finance visibility.
- **Dashboard, CRM insights and Performance:** connected scoped records/finance summaries and saved server targets are implemented. Broader response-time, external lead conversion and publication reporting remain future work. Do not expose private team totals to another Admin or assigned-only staff.
- **Client desk and matching:** connected Clients/Properties and saved-shortlist workflows are implemented; preserve permitted record visibility and classification as these expand.
- **Team activity and workspace directory:** authoritative Team/My activity feeds are implemented, with manager/member visibility. A platform company directory and metadata-only Super Admin dashboard remain future work; private business content stays outside audit.
- **Connected exports/backups:** honour export grants, preserve workbook/JSON compatibility and complete collections, make large exports durable jobs where required, separate authorised transfer from database disaster recovery.
- **Account/profile administration:** self-service name/phone/password changes and session review/revocation are implemented. Verification-backed email changes, recovery and MFA remain future work. Admins suspend former staff; they never need to see staff passwords.
- **Scalability:** move large collections, team directories, inbox and activity to indexed server filters/cursor pagination; avoid loading all future messages/media in the current bundled-record response. Test realistic team/record volumes using disposable fixtures.
- **Operational foundations:** restricted runtime DB role, migration ownership, encrypted backups, restore drills, asset recovery, dependency checks, request/job metrics, error redaction and alerting.
- **Cross-company deal agreements (Blaqks One):** recorded, tamper-evident hand-overs, co-broking and commission shares between companies and with outside agents, accepted only by the named recipient, with verification levels and an evidence certificate. Owner decisions are in [Product decisions](product-decisions.md#cross-company-deal-agreements-decided-2026-10-15-planned). Phases: (1) evidence certificate and payment tracking for in-company hand-overs; (2) agreements between Blaqks One companies; (3) outside agents by recipient-locked link; (4) UAE PASS signing, RERA Form I reference and dispute export. Starts after the core CRM, with architecture and security review first.
- **Connected-screen sequence (owner decided 2026-10-15): completed in source.** Performance/targets, CRM insights, Date search, connected Guide, My profile and Team/My activity are implemented. Their source is wired in `src/features/server/ServerContent.jsx`; the old "Not connected" queue is no longer the next work.

  **Blaqks One platform foundation has started.** S1 auth/consent/throttle groundwork (migration 0022), S2 company profiles (migration 0023), the local-only sign-up API (migration 0024), sign-up screens and authenticated setup are implemented locally. The 2026-10-18 owner revision adds migration 0025: every customer account is a company on a 3-seat Free plan, Team is available immediately, and Super Admin may change only the seat limit with immutable history. The earlier individual-mode and account-type-switch plan is retired. The profiles supply company metadata for the future **platform admin dashboard**: companies, plans, limits and platform health, with no default access to company business data. Subscription billing and hosted sign-up hardening remain future work.

- **Product vision queue (owner, 2026-10-16):** see [Product vision](product-vision.md). Planned in this order:
  1. Premium redesign direction and design system v2, right-to-left ready, with a chart-rich Dashboard first. **Paused (2026-10-16):** the owner kept the original design after trying Limestone and Midnight; see [Product decisions](product-decisions.md#premium-redesign-direction-decided-2026-10-16).
  2. Language preference: English and Arabic, then more languages, with message translation. **Decided 2026-10-16:** build the foundation next (translation catalogues, language choice in My profile, right-to-left layout, date/number/AED formatting per language); new features use it from the start, existing screens are translated in a later pass. **Foundation built (2026-10-16):** see [Language foundation](i18n.md); Arabic stays behind `VITE_I18N_PREVIEW` until the translation pass. New work keeps the current colours with [premium polish](design-standards.md#premium-polish-for-new-work-owner-2026-10-16).
  3. Blaqks One platform foundation.
  4. Field hints and calculators.
  5. Deal rooms: cross-company agreements with chat.
  6. Internal messaging, then provider integrations.
  7. AI assistant, in three levels.
  8. Video calls with live translation, in stages.
  9. Mobile app, AI lead agents and the developers module.
- **Queued messaging follow-ups (owner approved 2026-10-20):** see [Messaging security](messaging-security.md). (1) ~~X1a: redacted channel events in Team activity~~ built 2026-10-20; (2) provider-proven account IDs, canonical form and same-account reconnect checks in every real adapter (W1, E1, S1); (3) ~~in-flight attempts and lease-expiry `unknown` in the X2 worker~~ built 2026-10-20; (4) the credential keyring with the first decrypt (W1); (5) member-owned mailbox OAuth with Admin approval, and disconnect on member archive (E1); (6) `channel_access.social` grant (S1); (7) per-company phone region when first needed; (8) W2: a refused-webhook counter and an event-age limit shorter than receipt retention (X2-S7); (9) X3: refuse a new send for an object whose last job ended `unknown` unless a person chooses Send again.
- **Queued architecture follow-ups (owner approved 2026-10-15):** (1) automated boundary check for [Service boundaries](service-boundaries.md) rule 12; (2) own PostgreSQL schema for each new large module; (3) phase 1 boundary cleanups when files are touched anyway; (4) set hosting region (UAE or nearby) and launch traffic targets before deployment.
- **Queued hosting and infrastructure plan (owner approved 2026-10-15):** see [Tech stack](tech-stack.md). At launch: Cloudflare CDN, Nginx reverse proxy (HTTPS, prefix routing to `/api/crm`, `/api/public`, `/api/calendar`, limits, headers), managed PostgreSQL in a UAE region with backups, UAE-region object storage for media, no CDN/proxy caching of private CRM data. Later: Valkey/Redis for public caching or real-time features, an outbound forward proxy with the messaging phase, and a dedicated API gateway only for a partner API.
- **Queued public sign-up (owner decided 2026-10-15, flow decided 2026-10-16):** Brokerage firm or Independent agent as the first step, one company model with a one-person limit for independents and an in-account switch to brokerage; joining a firm by invitation with optional, Admin-accepted record transfer; verified email and mobile, licences checked only before public actions; all plans free for now. Company members still invited by their Admin; bot protection and rate limits; design and security review first. See [Product decisions](product-decisions.md#sign-up-decided-2026-10-15-planned).
- **Queued public website (owner decided 2026-10-20):** one general website plus optional paid company websites on a subdomain or the company's own domain, 4 themes, logo, one brand colour, fixed pages and company-built pages; English first. Packets WEB1–WEB9 in the [public website plan](public-website-plan.md); start with WEB4 design and WEB1 when the owner says.
- **Later:** customer mobile app, public self-booking, two-way calendar editing, sophisticated co-listing, automated campaigns, AI summaries/transcription and hard account deletion. Each needs its own reviewed scope; none is required to prove the first website/inbox release.

## 16. Acceptance scenarios and test rules

The next implementer should write tests around behaviour and boundaries, not merely field presence.

1. Admin A's manager and marketer have distinct approved profiles and listings on the same website; both properties stay in A's workspace.
2. Admin B cannot read A's private records, messages, attachments, notification counts or provider connections through any forged identifier.
3. Staff with create permission but no submission grant can save a draft and cannot submit/publish it. No staff/Admin command can approve publication.
4. Super Admin approves revision 1; a later draft, profile edit or image replacement cannot alter the live approved version. Suspended/archived eligibility blocks queued activation.
5. A repeated webhook creates one durable receipt/conversation/message/intake result. A replay after reconnect does not become a second lead.
6. A shared company Page's ambiguous enquiry goes to restricted triage, not every Admin. Old conversation ownership survives mapping changes.
7. An authorised staff member sends from a granted business sender. Removing the grant while a job waits blocks delivery; a forged From address never works.
8. A provider accepts a message but loses the response. The system reconciles or reports unknown outcome; a retry does not silently send a duplicate.
9. Bulk send excludes suppressed/unqualified recipients, hides other clients' addresses and reports individual queued/failed/accepted outcomes.
10. Calendar save/retry creates one appointment/event, waits for its conference link, then notifies once. Reschedule/cancel is tested with revoked connections and timezone differences.
11. A website enquiry routes from authoritative publication data, not visitor-supplied workspace/agent IDs; repeated taps do not create duplicates.
12. Keyword tests distinguish “looking to rent” from “available for rent”, negation, spam, Arabic/English variants and unknown budget. Reviewed conversion retains source without inventing contact details.
13. Staff departure preserves company records/history, prevents token reuse and moves unresolved assignments to the authorised team queue. Archived workspaces stay read-only.
14. UI checks cover dark/light desktop/tablet/mobile, keyboard focus, overlays, long names, empty lists, search/filter combinations, pagination and partial failures. Compact summaries expand to all items; large selectable directories scroll.
15. Operational checks exercise worker/database restart, expired token, throttling, late status events, provider outage, backup restore and the documented publication takedown interval across API/search/pages/agent pages/sitemaps/CDN. A delayed approved job cannot republish a withdrawn revision; new enquiries to ineligible listings are rejected, while already accepted enquiries enter authorised recovery without mutating an archived workspace.

Use the existing Docker disposable test project; never seed or truncate the development database to test 200 accounts. Retain the default demo regressions and existing storage/import contracts. Run applicable unit/build/browser checks, CRM Cargo tests/format/Clippy for API changes, and full/focused file-size checks. Split an oversized file whenever a packet changes it, and explicitly report remaining violations.

Keep a distinction between deterministic mocked tests, real local API/database tests and authorised provider sandbox evidence. Real account connection, paid subscriptions and contacting recipients require the appropriate operational authorisation at implementation time; this planning request authorises none of those external effects.

## 17. Business decisions to settle before the dependent packets

These can be discussed without stopping independent foundation work.

| Decision                             | Recommended starting point                                                                           | Affects                                            |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| Business mail system                 | Select the provider actually used by the company; pilot one, add the other later                     | Email OAuth, inbox scope/review, calendar priority |
| WhatsApp ownership                   | One dedicated business number per Admin team where practical; otherwise explicit organisation triage | Routing, privacy, assignment and ongoing costs     |
| Social account ownership             | Team-owned resource by default; company accounts use canonical organisation intake                   | Connector grants and lead routing                  |
| Staff record visibility              | Team supervisors whole-team; consultants assigned records where needed; explicit Admin choice        | P1 permission model, search and export             |
| Listing representative eligibility   | Approved professional profile separate from editing privileges                                       | Public profiles, permits, agent reassignment       |
| Same property promoted by coworkers  | One public listing with one primary agent and internal collaborators                                 | Duplicate detection; optional later co-listing     |
| Enquiry allocation                   | Approved agent first, then same-team Admin queue                                                     | SLA, agent absence and recovery                    |
| Super Admin communication visibility | Disclosed business-resource oversight; no automatic personal mailbox ingestion                       | Connection onboarding/privacy/permissions          |
| Marketing campaigns                  | Disabled initially; approved audience, consent/suppression and budget when enabled                   | Bulk email/WhatsApp, calls and policy              |
| Calling                              | Phone/dialler shortcut first; provider-based calling only after UAE eligibility review               | Telephony provider and cost                        |
| Hosting and retention                | Decide jurisdiction, backup/object-storage regions, retention and provider deletion procedures       | Operations, legal review and vendor contracts      |
| Public languages/mobile              | English first, right-to-left ready (decided 2026-10-20); decide native app targets                   | Public schema, content workflow and P11            |

Costs must include hosting/PostgreSQL, object storage/media traffic, mail delivery, WhatsApp/provider charges, X/data usage, possible security assessments, monitoring/backups and optional telephony. Do not bake today's prices or assumed free tiers into the business plan. Request actual quotes and set per-workspace budgets before activation.

## 18. Handoff instructions for Claude Code

Read this file together with the current `AGENTS.md`, design standards, architecture and relevant feature docs. Begin at P0, inspect the actual diff and migrations, and preserve existing data and work. Reverify provider capabilities/scopes, versions, eligibility and pricing immediately before each connector implementation; this research is a dated planning baseline.

For each selected packet, produce a short implementation design covering affected contracts, permissions, migration/backfill, UI states, provider requirements, rollback and tests. Implement the complete narrow flow, then report changed files, checks, remaining risks and real-versus-mocked evidence. Maintain the 150-line limit by responsibility, normal formatting, current workbook/storage compatibility and the default demo/connected separation.

Do not infer that a job title grants publication, mailbox access or sending. Do not change Admin workspace ownership to support staff agents. Do not replace exact-version Super Admin approval with direct Admin publishing. Do not build unsupported inbox/search features behind successful-looking controls. Do not merge provider contacts across Admin workspaces. Do not restore the old Calendar companion's trust model as production authentication.

Recommended first implementation target after discussion: **P0 → P1 → P2**, followed by one real email/inbox flow and the media/publication branch. Begin provider eligibility applications in parallel using approved business accounts. This gets the business a working, verifiable path to leads, replies, meetings and one shared website without waiting for every social platform to expose the same API features.
