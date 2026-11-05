# Blaqks One console (BO1)

Owner, 2026-11-05: "the Blaqks One back end … does not list properties; it only monitors and controls the agents and companies using our app. When a client sends us a request for help we need to see the notification. We can still create team members, but not like brokerages. We should not be able to see what a company is doing, and we should not switch from our side into a client's workspace. We track transactions, users and everything worth tracking, to build a strong portfolio for investors."

This designs the queued BO1 packet ([product decisions](product-decisions.md), "Blaqks One platform (BO1)"; [roadmap §15](claude-implementation-roadmap.md#15-remaining-connected-crm-work-outside-the-integrations)) with the owner's answers of 2026-11-05.

## 1. Decisions (owner, 2026-11-05)

| Topic                     | Decision                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Company data              | Blaqks One has **no access** to any company's clients, contacts, properties, activities, deals, payments, expenses, messages, agreements, website drafts or enquiries, and **no workspace switching**. Consented support access (from the 2026-10-23 decision) is **not built**; it may return later as its own packet.                                                                                                                                                                                                                         |
| Investor tracking         | **Platform totals and trends** (companies, users, active users, listings published, deals recorded and their total AED value, website enquiries, marketplace activity, help requests; added the same day: number of websites, clients from the websites, property sold from our websites, transactions between brokers, users outside the companies, growth, retention and engagement) plus **per-company usage only** (seats, active users, last active, number of records). No money figures per company, no client names, no single records. |
| Help requests             | **Any member** opens Help from the account menu. Blaqks One is notified and answers **in the same thread**; the request moves Open → Waiting → Solved and the sender is notified of each reply.                                                                                                                                                                                                                                                                                                                                                 |
| Blaqks One team           | Three roles, separate from brokerage roles: **Owner** (everything, including the team and company controls), **Support** (help requests and the company list), **Analyst** (dashboard and metrics only).                                                                                                                                                                                                                                                                                                                                        |
| Imports and archived data | Browser and backup **imports move to each company's Admin**, into their own workspace. **Archived members' records are read by their company Admin** (read-only). A whole archived company's records stay kept, unread, until it is restored.                                                                                                                                                                                                                                                                                                   |

## 2. What Blaqks One sees and does

- **Start**: the platform dashboard (§5), with the help requests waiting for an answer.
- **Platform** product: Dashboard, Companies (each company's Admin, status, seats, usage, marketplace state; members as name, role, status and last active), Help requests, Marketplace applications, Platform website (the general site's content, as today).
- **Controls** (Owner only): invite a company's owning Admin, set seat limits, suspend or archive an account or a whole company and restore it, revoke a company's marketplace access, revoke a company's outside links (A6). Every control is recorded in the platform activity log with the actor; no business content is recorded.
- **Settings**: My profile, Sign-in and security, and **Blaqks One team** (Owner only).
- Not shown: CRM, company Websites, Marketplace board, Messages, Agreements, Channels, Inbox rules, Team activity of any company, the workspace switcher.

The internal role name `super-admin` stays in the database for the Owner (renaming stored values buys nothing); every screen says **Blaqks One**.

## 3. Packets, in build order

1. **BO1a Access lockdown and rename** (security review before and after).
   - API: `workspaces::ensure_access` and `workspaces::member` stop passing the Blaqks One account into company workspaces; every handler that special-cases `super-admin` (records, history, finance overview, performance visibility, team audit, sample data, company sites, member directory's archived view, imports) refuses it or hands the power to the company Admin as decided. Platform handlers (companies, seat limits, archive and restore, marketplace decisions, platform website, inviting owning Admins) stay.
   - The Blaqks One organisation workspace (`super-admin-workspace`) has no CRM: its leftover records stay stored and unreachable (in development it holds one contact); a trusted command can later move records to a named company if any matter.
   - Imports: the live owning Admin imports into their own workspace with the same review and add-only commit; personal sources go to a chosen member of that company.
   - Archived members: the company Admin reads their archived members' records read-only; the archived list and its record views move from the Super Admin to the Admin.
   - Frontend: the products and settings above; no switcher; "Super Admin" becomes "Blaqks One" everywhere in the app (the frozen Arabic catalogue is untouched).
   - **Built 2026-11-05** (`feature/blaqks-one-console`): every item in §6. The API refuses Blaqks One on any company workspace and the organisation's records; the Companies screen opens a company panel (people with Suspend, Reactivate and Archive, seats with Change seat limit) through `GET /api/crm/platform/companies/{workspace}/members` and `PUT …/members/{id}/active`; the Blaqks One invite form offers Admin accounts only; imports are the owning Admin's with a receiving member (migration 0089). Verified: the full API suite, every affected browser spec, unit tests, Rust tests, Clippy and the repository checks.
2. **BO1b Blaqks One team.** A new role `platform` with `platform_role` `support` or `analyst`, belonging to the Blaqks One organisation; the Owner invites, changes and archives them on the Blaqks One team page (name, email, phone, role), through the existing invitation and activation flow. Platform staff can never be given company grants, and company forms never offer platform roles. Every platform handler checks the live role: Owner for controls and the team, Owner or Support for help requests and the company list, any platform role for the dashboard.
3. **BO1c Help requests.** A new `support` module with its own tables (`crm_support_requests`: company workspace, requester, subject, category, status, timestamps; `crm_support_messages`: request, author, side, body, time) and routes; the member side under the caller's workspace, the platform side for Owner and Support. The member's form says not to include clients' personal details. Badges: Blaqks One sees the number of requests waiting for a Blaqks One answer on Help requests and in the bell; the requester sees replies they have not read. Only the requester and the Blaqks One team read a thread (not the company Admin). Activity records "help request opened/answered/solved" without the subject or body.
4. **BO1d Dashboard and metrics.** A `platform_metrics` module that only aggregates, through count functions each owning module provides (no reads of another module's tables, per [service boundaries](service-boundaries.md)):
   - Companies: total, active, archived, new per month.
   - Users: active accounts by role, new per month, **daily and monthly active users** from a new `crm_user_active_days (user_id, day)` table filled once per user per day when a session is used (history starts when this ships).
   - Users outside the companies (owner, 2026-11-05): outside agents with a free basic account (once A6 ships) and **website visitors** (unique visitors and page views per month, counted on our own servers without third-party trackers or personal data; a small addition to the website relay).
   - Records: platform totals per type (counts only), and records added per month.
   - Websites (owner, 2026-11-05): **number of company websites live** plus the general site, listings live, **enquiries per month and how many became leads** ("clients from the websites"), split by general site and company sites.
   - **Property sold from our websites** (owner, 2026-11-05): earned deals whose client came in through a website enquiry, as a count and their **total AED value**, per month.
   - Deals: recorded per month and by state, **total AED value platform-wide** (earned and open separately), average deal value, total commission earned, payments recorded.
   - **Transactions between brokers** (owner, 2026-11-05): agreements between companies (co-broking, hand-overs, marketplace answers that became agreements) per month, by state, and the **total AED value** of their deals and of the commission shared.
   - Marketplace: companies approved and joined, requests posted, answers, agreements made.
   - Web funnel: website enquiries → leads → viewings → earned deals, as platform-wide counts per month.
   - Growth and retention: new companies and users per month, companies active this month against last month, companies that stopped using the app (no member active for 30 days), median days from sign-up to a company's first earned deal.
   - Engagement: daily and monthly active users, records added, emails and WhatsApp messages sent, team chat messages (counts only, never content).
   - Help requests: open, solved, median time to first answer.
   - Per company: name, Admin, created on, status, seats used of the limit, active users in 30 days, last active, number of records. No AED figures.
   - Twelve-month trends as charts, a period switch (30 days, 12 months, all time) and **Download CSV** of the platform totals for investor packs.

## 3a. Track everything worth tracking (owner, 2026-11-05)

"Everything worth tracking should be tracked; that gives us more value and relevance." Besides the counts above, BO1d adds one **platform event log** that every module writes to at the moment something meaningful happens, so any figure investors ask for later can be worked out from history instead of starting from zero.

- **Table** `crm_platform_events` (owned by `platform_metrics`): time, event name, company workspace (or none), the actor's role (never the person), the source (CRM, company site, general site, marketplace, API) and, for money events, an AED amount in fils. No names, record IDs, text, addresses or message content.
- **Money events carry no company.** Deal earned, payment recorded, commission earned, agreement accepted and property sold through a website are stored with their amount and **without** the company, so platform-wide sums are possible but no one can rebuild a company's turnover. Usage events carry the company and no amount.
- **Events tracked from the start:** sign-up started, verified and finished; sign-in; invitation sent and accepted; member suspended or archived; each record type created, changed and deleted; lead stage moved; viewing booked and done; follow-up done; deal created, stage moved, earned, lost; payment and expense recorded and approved; agreement offered, accepted, completed, cancelled (and between companies); listing published and withdrawn; company website switched on; website enquiry received and turned into a lead; marketplace application, request posted, answer sent, answer chosen; record shared with a colleague or another company; email and WhatsApp sent and received, team chat message sent; export and import run; help request opened, answered and solved; feature used (which screen or tool, once per person per day); and errors shown to people (for platform health).
- **Website visitors** are counted by the website relay as page views and daily unique visitors per site, with a daily rotating salt instead of storing IP addresses or cookies.
- **Keeping it useful:** events are kept for at least five years; the dashboard reads daily summaries built from them; the Owner can download the summaries as CSV. New events are added in the module that owns the action, with a test that no personal or business content is stored.

**BO1d built 2026-11-05** (`feature/blaqks-one-console`): the `platform_metrics` module in its own PostgreSQL schema (migration 0090: the immutable event log, money events without the company enforced by a check constraint, and daily active users), `platform_counts` functions in each owning module, `GET /api/crm/platform/metrics`, and Platform → Dashboard with the period switch, Download CSV, tiles, twelve-month trends, the figure panels and the company usage grid. Website visitors and the median days to a first earned deal show "Not tracked yet" until their data exists. Verified: the full API suite (687 passed; the restart check now signs in as a company Admin), the dashboard browser spec in both themes at 390 and 1280, unit and Rust tests, Clippy and the repository checks.

## 4. Security notes for review

- The lockdown is the dangerous part: the review lists every `super-admin` special case (about 35 sites in `services/crm-api/src`) and the test plan proves refusal for records, finance, activity, sites, media, imports and record history from the Blaqks One account, while companies' own access is unchanged.
- Metrics return counts and platform-wide sums only; per-company rows never carry money, names of clients or record text. Small companies make "records per company" a usage figure, not business detail; it is shown as a total, not per type.
- Help request bodies are written by members to Blaqks One on purpose; they stay out of activity, search and notifications' text.
- Platform staff sessions follow the same session, CSRF and live-membership rules; a role change or archive takes effect on the next request.

## 5. Screens

The platform dashboard follows the CRM Dashboard's figure tiles and panels: a row of figure tiles (companies, active users, listings live, deals this month with their AED total), the trend charts, Help requests waiting, newest companies, and the per-company usage grid with search and the shared grid footer. Help requests use the Client inbox's three-pane pattern (list, thread, company card with plan and seats). Everything follows the approved mockup's style, light and dark, phones included.

## 6. BO1a security review (2026-11-05) and the implementation checklist

The security engineer's review traced every path from the Blaqks One account (`super-admin`, workspace `super-admin-workspace` = `workspaces::ORGANISATION`) into company data. Answers to its open questions (owner 2026-11-05 for Q3; the rest follow the owner's earlier answers): **Q1** Blaqks One keeps suspending and archiving a company's individual agents, through a platform route on Companies, never by entering the company; **Q2** there is no restore yet, so it is not part of BO1 (a later, separately reviewed packet); **Q3** any company Admin may import the organisation browser set into their own company; **Q4** an archived agent's records still go to the Admin queue and stay editable company records, only the account is read-only; **Q5** no organisation staff exist; staff invitations into the organisation are refused; **Q6** the Owner keeps the organisation's own team feed until the platform activity log exists; **Q7** marketplace application review keeps its per-type record counts, which the MK1 eligibility check needs.

**API (services/crm-api/src)**

1. `workspaces::ensure_access` passes only the caller's own workspace, for roles `admin` and `staff` (an allowlist, so later platform roles are refused by default), never `ORGANISATION`. This one gate covers records, files, assignments, activity, finance, performance, team and imports.
2. `workspaces::member` (and `ensure_writable`) drops the `super-admin` exception.
3. `GET /workspaces` returns the caller's own workspace only; the organisation is labelled "Blaqks One".
4. A single platform guard `workspaces::platform::operator(tx, actor)` (the live organisation member with role `super-admin`), re-read inside each platform handler's transaction; sites, seat limits, marketplace decisions and the new agent controls use it.
5. `team::access::resolve_owner`: the Blaqks One account resolves only the organisation; an Admin only their own workspace; no archived owners.
6. The archived member list moves to the Admin for their own workspace; the Owner keeps archived Admins in the organisation.
7. Staff invitations into the organisation are refused; Admin invitations stay.
8. Archiving or suspending a company's agent goes through a platform route (operator, live company owner, target must be that owner's member), re-reading the operator under the archive lock.
9. Seat limits use the operator guard and `lock_active_admin`, not `ensure_writable`.
10. Imports: the live owning Admin into their own workspace only; staff and Blaqks One refused; a personal source names a live, accepted member of the same company (checked at preview and again at commit under the lock, and stored with the plan); the organisation source imports into the Admin's own company; parents go to the chosen member.
11. The Blaqks One profile carries no CRM permissions, record actions or finance scope (`Permissions::default`, finance scope none); `manages_team` stays for its own team.
12. Remove the dead `super-admin` branches in records history, finance overview, performance visibility and activity query.
13. The sample-data command refuses the organisation.
14. Already refused today and kept with regression tests: media upload, record shares, inbox, chat, agreements, listing shares, integrations, mailbox, numbers, company sites, enquiries, marketplace member routes, company profile.

**Frontend (apps/crm/src)**

15. `ServerDirectory` always uses the caller's own workspace (no `?workspace=`); Blaqks One gets a platform shell that never loads records or media.
16. The workspace switcher, picker dialog and every "Open" link into a company are removed; seat limits and agent controls live on Companies.
17. `canOpenSection`: Blaqks One opens only the platform routes, My profile and Sign-in and security; the product rail, settings groups and Start follow.
18. Team & access: the archived tab for the Admin's own staff; imports become the Admin's, choosing a member of their company instead of a workspace.
19. "Super Admin" reads "Blaqks One" everywhere outside the frozen Arabic catalogue; AGENTS.md, data migration, private workspaces and the security engineer's instructions are updated with the new rules.

**Tests (apps/crm/tests/api)**: T1 the workspace list is the caller's own; T2 every data family refuses Blaqks One on a company workspace; T3 the same on the organisation, leftover rows untouched; T4 an archived company stays unreadable; T5 regression refusals for the already-refused families; T6 platform powers still work (companies, seat limits, inviting Admins, archiving agents and Admins, marketplace decisions, platform website); T7 the Blaqks One profile has no CRM permissions; T8 companies' own access and isolation unchanged; T9 imports by the owning Admin with the member checks and refusals; T10 the Admin's archived list is their own staff only; T11 no staff invitation into the organisation, and the sample command refuses it.

## 7. BO1d metrics contract (2026-11-05)

`GET /api/crm/platform/metrics?period=30d|12m|all` (default `30d`), for the live Blaqks One account only (`workspaces::platform::operator`); everyone else gets 403. Money is in integer fils; `null` means not tracked yet and is shown as such, never as 0. The organisation workspace and the Blaqks One account are excluded from every company and user figure.

- `totals`: companies (total, active, archived); users (total, admins, staff, pending); active users (today, last 7 and 30 days, from `crm_user_active_days`); records (total and by collection); websites (company sites live, general site live, listings live); deals (recorded, open, earned, lost, earned and open value, commission earned, average earned value); payments (recorded, approved total); between brokers (agreements, accepted, completed, value, commission shared); marketplace (companies approved, members, requests posted, answers); outside agents; website visitors.
- `inPeriod`: new companies and users, records added, enquiries and those that became leads, viewings, deals earned and their value, property sold through the websites (count and value), agreements between brokers and their value, emails, WhatsApp and team chat messages sent, sign-ins.
- `trends`: twelve months, oldest first: new companies, new users, monthly active users, records added, enquiries, deals earned and their value, agreements between brokers.
- `growth`: companies active this month and last month, companies that stopped (no member active for 30 days), median days from a company's sign-up to its first earned deal.
- `companies`: per company name, Admin, joined, status, seats used and limit, active users in 30 days, last active, number of records. No money.

The screen is Platform → Dashboard (`/platform-dashboard`): the period switch and Download CSV, figure tiles, twelve-month trend panels, panels for websites, deals and money, transactions between brokers, marketplace, growth, messages and activity and users outside the companies, then the per-company usage grid.

## 8. BO1b Blaqks One team: roles and areas (owner, 2026-11-05)

Owner answers of 2026-11-05: people on the Blaqks One team get **a role as a starting preset plus ticks for exactly the areas they may use**, and the team is built before help requests. They never see a company's clients, deals or messages, whatever they are given.

**Areas.** `dashboard` (Platform → Dashboard and its CSV), `companies` (the company list and the company panel's people, read only), `company_controls` (suspend, reactivate and archive a company's people, change seat limits), `invite_admins` (Team & access: invite and cancel invitations of companies' owning Admins), `marketplace` (marketplace applications: approve, decline, revoke), `platform_website` (the general site's content and company website eligibility), `help_requests` (BO1c; reserved until it ships). `company_controls` needs `companies`.

**Presets.** Support: companies, help requests. Analyst: dashboard. Platform admin: every area. The preset only fills the ticks; the saved ticks decide.

**Accounts.** A new role `platform` in the Blaqks One organisation, with a row in `crm_platform_access` (owned by `team`: user, preset, areas, version). Only the Owner (`super-admin`) invites, edits, suspends, reactivates and archives platform staff, on Settings → Blaqks One team, through the existing invitation and activation flow. Platform staff never manage the team, never change their own areas, never invite platform staff, and are never offered company positions, module grants or a CRM workspace; company forms never offer the platform role.

**Enforcement.** `workspaces::platform::operator(tx, actor, area)` re-reads the live account inside the handler's transaction: the Owner passes every area; a live `platform` member passes only an area in their saved ticks; everyone else is refused. Every platform handler names its area. `ensure_access` keeps refusing the platform role (its allowlist is admin and staff). The profile sent to the browser carries `platformAreas` for showing pages; the server decides every request.

**Screens.** Settings → Blaqks One team (Owner only): the people with role, areas, status and last active; Invite (name, email, phone, role preset, area ticks); Edit areas; Suspend, Reactivate and Archive. Platform staff see only the pages of their areas, plus My profile and Sign-in and security; the company panel shows its controls only with `company_controls`.

**Security notes.** The role constraint, the access row and the invitation are written in one transaction; an area list is validated against the fixed list; a role or area change and an archive take effect on the next request; the Owner account can never be edited, suspended or archived from this page; the platform activity records who changed whose areas, without other details.

## 9. BO1e Blaqks One's own clients (owner, 2026-11-05)

"We do not post listings, but we can also have clients, and some people with access can work on them, calling them or texting them if they need our services." Owner answers of 2026-11-05: Blaqks One gets **its own sales list**, separate from every company's clients and from the property CRM, built after the team (BO1b) and before help requests (BO1c).

- A client is a brokerage or agent interested in Blaqks One: company name, contact person, phone, email, source (marketing website form, help request, referral, call, other), stage (New, Contacted, Demo booked, Signed up, Customer, Lost), notes and a next follow-up, with Call, WhatsApp and Email buttons. No listings, no property fields.
- When the client signs up, the record links to their company, which feeds the dashboard's conversion figures.
- The marketing website's contact form adds a client automatically (today it posts to `CONTACT_WEBHOOK_URL`).
- Team members with the `clients` area work on them; the Owner always can. It is its own module with its own tables and routes, and it never touches company data.

## 10. BO1f Blaqks One messaging (owner, 2026-11-05)

"We can also send text messages, so most of the features the Super Admin had will be here too?" Yes, for Blaqks One's own work only: the features that serve Blaqks One's business return, scoped to Blaqks One's own data, and nothing returns that reaches inside a company.

- **Comes back:** Blaqks One's own team chat among its team; its own inbox and channels (its mailbox and WhatsApp number) for messaging its own clients (BO1e); Call, WhatsApp, Email and text buttons on each client (opening the phone's apps at once, as the CRM's Call button does); dashboard, companies, marketplace applications, platform website and help requests as already planned.
- **Stays out:** any company's clients, contacts, properties, deals, payments, team chat or inbox, and switching into a company.
- **In-app SMS** needs an SMS provider (Twilio SMS), not connected yet; it follows the WhatsApp sending work (W1b).
- Order: BO1b team, BO1e clients, BO1f messaging, then BO1c help requests.
