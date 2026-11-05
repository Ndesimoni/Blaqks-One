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
