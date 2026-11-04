# Design redo queue: screens still to match the mockup

Owner, 2026-11-01: "match the design 1 to 1; if any feature is left out, let me know". Owner, 2026-11-02: keep every screen that has not been redone in one list, and do them **one at a time**.

The reference is the approved clickable mockup (link in [product decisions](product-decisions.md), "Mockup approved"); each item names the mockup's route key (`crm.properties.list` and so on). Work happens on the `design/bitrix24` branch.

## How each item is done

1. Read the mockup's screen for the route key and compare it with ours.
2. List every feature ours has that the mockup leaves out. The standing rule ([CRM grid one to one, nothing lost](product-decisions.md)) is to keep them in the mockup's style. Ask the owner only if keeping one is not possible.
3. Build it, run its unit and connected browser specs (`PLAYWRIGHT_CHANNEL=chrome` on macOS 12), commit, and tick the item here with the commit.
4. Tell the owner what changed and what is left out, then go straight on to the next item (owner, 2026-11-04: no go-ahead needed between items).

## Done

- [x] App frame: top bar with the section name, + Create, search, notifications, chat strip (NAV5, steps 1a and 1b)
- [x] Messages: Client inbox and Team chat (step 6)
- [x] Settings → Team & access: seat bar and member panel (NAV step 3)
- [x] Websites: four sidebar sections; Content with the publish bar and live preview
- [x] CRM grids: Clients, Contacts, Shortlist, Client care (`7055f68`, `3d68c38`, `9146457`)
- [x] Payments and Expenses (`13dc863`)

## Queue, in order

### CRM

1. [x] **Follow-ups** (`8ace74d`; Done saves Completed, Later / No due date / Closed kept) (`crm.activities.followups`): one filter field ("My follow-ups"); Overdue / Today / This week groups; rows with a checkbox (mark done), bold title · client, time on the right. Ours to keep or report: the No due date and Closed groups, the List view, the Overdue / Open / Completed presets.
2. [x] **Viewings** (`8218159`; weekend days, No time row and Unscheduled kept) (`crm.activities.viewings`): Today, the date range, a Monday–Friday time grid with event chips, List / Week. Ours to keep or report: Saturday and Sunday, the Unscheduled section, List columns and sorting, the presets.
3. [x] **Leads** (`3147f2e`; Source with counts, Lead stage, Assigned to and the Kanban's moves kept) (`crm.leads.leads`): presets My leads / New this week / Hot / From the website; List (Lead, Looking for, Budget, Stage, Agent, Source) / Kanban; staff see "Showing the leads assigned to you". Ours to keep or report: the source chips, the Kanban's stage changes, the row Message button.
4. [x] **Properties** (`54e05c5`; All listings stays the default, Available is the first chip; refine panel and purposes kept) (`crm.properties.list`): one filter field ("Available"), List / Cards; cards with photo, title, price, facts and a status pill; list columns Property, Price, Details, Status. Ours to keep or report: the property filters panel and active filter chips, the table view's columns and row buttons.
       4b. [x] **Record slider, starting with Properties** (`cc838bb`; owner phone masked as in the mockup; Share asks "A colleague" or "Another company", Publish on website is the primary when offered, Delete and Edit record kept, the Website pill beside the status; the timeline adds Follow-up, Viewing and Conversation (the mockup's Note); connected sections now full-width rows) (owner, 2026-11-02: "the slide and the components inside need serious work"; item 36 brought forward): the mockup's header (title, price · area, Share and Publish on website, status and website pills), gallery (one large photo, two small), facts card and the private box on the left, the activity timeline on the right; fix the overlapping columns; connected sections (assignment, sharing, website) and the floor plans, amenities and building contacts stay, below.
5. [x] **Deals** (`416c9c2`; Closing this month reads the target close date; Stage, Earned and Assigned to kept as pills; Agent and commission columns kept, Net fee, Payment and Target close in the gear; all ten stages kept as columns; deal slider `d3e780c`: stage bar, Record payment, Move to the next stage, facts, commission split, payments and history) (`crm.money.deals`): presets All deals / Closing this month, List / Kanban with Viewing / Negotiation / Offer made / Contract columns. Ours to keep or report: the current deal filters, board and list, commission and approval actions.
6. [x] **Interaction log** (`1396bb3`; "Everything"; titles name who and how; day headings, topic, listing, summary and next action kept) (`crm.activities.log`): an activity feed under one filter field ("Everything"). Ours is already a feed; compare and close the gaps.
7. [x] **Client desk** (`d8b7d44`; Call and Message (as on the client slider) replace the preview box; Open client replaces Edit profile; lead quality kept as a pill; match photos dropped for the mockup's compact cards; activity is the slider's timeline) (`crm.clients.desk`): a client picker ("Find a client"), the chosen client and their property matches.
8. [x] **Dashboard** (`1f98bf9`; owner kept Team finance, lead charts, Upcoming viewings, Records in view and, for now, Get started; tiles carry trends, finance a collected meter; Your priorities gives way to Today) (`crm.dashboard.overview`): figure tiles first, then the mockup's panels. Report our extra panels before changing them.
9. [x] **Reports: Performance** (`ad99920`; lead response in days, not hours, as leads keep only the day they arrived; goals, chart and history kept below) (`crm.reports.performance`): tiles (deals won, commission earned, average days to close, lead response time) and one bar per agent on one scale.
10. [x] **Reports: CRM insights** (`ef41a4c`; old figure tiles kept as feed lines; four panels kept below; no filter field above the feed, as there is nothing to filter) (`crm.reports.insights`): tiles such as Leads from the website.
11. [x] **Reports: Date search** (`f7c5c4a`; changes apply with Search, Clear returns to the last 30 days; results grouped by date kept below; browser spec passed on 2026-11-04) (`crm.reports.dates`): a From / To form and its results.
12. [x] **Tools: Calculators** (`ee8fa7c`; Send to a client starts a new email with the summary; editable rates, off-plan milestones with optional dates and the schedule download kept; mortgage down payment now a percentage) (`crm.tools.calculators`): calculator choice, fields and the result.
13. [x] **Tools: Guide** (`a4fc902`; 18 articles written from our real screens, the old workflow steps and access notes among them; topic chips and Open for the section kept; no "Was this helpful?") (`crm.tools.guide`): "Search the guide", articles grouped by topic, an article page with steps and related guides.

### Settings

14. [x] **My profile** and **Website profile** (`e61b1b0`; Profile, Website profile and Sign-in and security as header tabs; account details, language, field guidance, password and devices kept; company profile stays on Profile until item 15) (`settings.profile.profile`, `settings.profile.website`)
15. [x] **Company details** (`dd16f17`; owner chose the new fields: trade licence number, office phone and office address saved on the server; marketplace switch asks before turning off; plan and seats; company form moved off My profile) (`settings.company.details`)
16. [x] **Team finance** (`a3f7dcc`, built by Codex; mockup cards and Company-style save bar; exact Pending approval/self-review note; all split, referral, VAT, TRN and dated agent agreements kept; future-agreement removal now confirms in-page) (`settings.team.finance`)
17. [x] **Channels** (`a476797`; cards with a status pill and Connect / Manage, each opening a right-hand panel; Facebook Page and Instagram stay two cards, as they connect separately; members' numbers and sending addresses moved into the panels) (`settings.channels.channels`)
18. [x] **Inbox rules** (`f608a99`; mockup cards and save bar; Blocked senders now lists blocked conversations with Unblock; existing-clients and routing cards kept; the members' private WhatsApp counts card left out, no server count yet) (`settings.rules.rules`)
19. [ ] **My mailbox** (`settings.mailbox.mailbox`)
20. [ ] **My WhatsApp** (`settings.whatsapp.whatsapp`)
21. [ ] **Team activity** (`settings.activity.activity`)

### Websites

22. [ ] **Team** (`web.team.team`): grid Person, Profile, Publishing, Live listings; presets Everyone / Shown / Waiting for consent.
23. [ ] **Listings: Live and Withdrawn** (`web.wprops.live`, `web.wprops.withdrawn`): live count with Publish a property; grids Listing, Public price, Agent, Status (presets Live / Changes not public) and Listing, Agent, Withdrawn, Reason.
24. [ ] **Enquiries** (`web.enquiries.enquiries`): grid Received, From, About, Lead; presets This week / Not answered.
25. [ ] **Old content page** (`web.content.old`): compare and close the gaps.

### Marketplace

26. [ ] **Board** (`market.board.board`)
27. [ ] **My requests: Open and Closed** (`market.requests.open`, `market.requests.closed`): grids Request, Client budget, Offers (three offer slots), Expires; Request, Outcome, Closed.
28. [ ] **Agreements: Incoming, Sent and All** (`market.agreements.*`)
29. [ ] **Broker profile** (`market.profile.profile`)
30. [ ] **Updates** (`market.updates.updates`)

### Platform (Super Admin)

31. [ ] **Marketplace applications: Waiting and Decided** (`platform.papps.pending`, `platform.papps.decided`)
32. [ ] **Websites: General site and Companies** (`platform.pweb.general`, `platform.pweb.companies`)
33. [ ] **Workspaces: Companies** (`platform.pworkspaces.companies`): grid Company, Admin, Seats, Marketplace; presets Active companies / Archived.

### Sign-in and shared patterns

34. [ ] **Sign in and sign up**: the split screen with the brand panel, the three-step sign-up progress, password rules and the code entry.
35. [ ] **Start page**: compare with the mockup's product cards, Messages strip and the Get started checklist.
36. [ ] **Record slider**: compare with the mockup's large right-hand slider (gallery, fields, private box, activity timeline).
37. [ ] **Create form slider**: compare with the mockup's create form (sections, step chips, footer).
38. [ ] **Empty, loading, error and no-access states**: compare with the mockup's state pages and skeletons.

## Audit of items 12–38 (2026-11-04)

Screenshots of every remaining screen against the mockup: none matches yet, so none is ticked.

- Closest: the Start page (cards and Messages strip are there; the Websites and Marketplace cards lack their figures and second button, and the strip lacks Marketplace chats).
- Older layouts to redo: Calculators (all four stacked, not one picked by chips with a Result card), Guide (a workflow page, not searchable articles), My profile (one long page; the mockup splits Profile, Website profile and a separate Company section), Channels, My mailbox and My WhatsApp (not the mockup's connection cards), Inbox rules (no save bar or version line), Team activity (filter form, not the feed).
- Grids not yet on the shared grid: Website Team, Properties and Enquiries; Marketplace applications; Platform website Companies.
- Marketplace has two sidebar sections (Marketplace, Agreements) where the mockup has Board, My requests, Updates, Agreements and My broker profile.
- Platform Workspaces is still "Not connected yet" for the Super Admin; the workspace directory and seat-limit APIs exist, so item 33 is frontend work.
- Sign-in has no brand panel yet.

## Left out so far (reported to the owner)

- Shortlist "Added by": the server does not record who added a match.
- No select column on Shortlist, Client care, Payments and Expenses: no bulk action exists for them yet (owner may ask for Delete or Export of selected rows).
- Payments and Expenses keep their own add buttons: + Create does not offer them yet.
- Phones keep cards, without selection.
- Deals (5): our ten stages stay (Offer and Documentation keep their names rather than the mockup's "Offer made" and "Contract"); Add deal stays on the page, since + Create does not offer deals yet; the deal slider keeps a footer with every deal action (the mockup shows only its two header buttons) and a history card in place of the mockup's add-activity timeline.
- Company (15): the save bar shows the version, not who saved it or when (the company's history keeps the actor, but not for display yet); seats show the total in use without the number of invitations.
- My profile (14): no "Let your Admin manage" card (that delegation, WD1, is not built yet); Language stays its own card (the frozen Arabic preview), not a select inside the form; Public WhatsApp and email stay typed fields, not choices of the member's company number and address.
- Guide (13): no "Was this helpful?" buttons, since nothing would save the answer; articles show only for sections the person can open.
- Record slider (4b): the timeline has no "+ Activity" menu (its three add buttons cover it) and no "Published on the website" or "Price set" events (the timeline reads CRM activity only; price history is not recorded). Contact and client sliders (Call, Message, linked records) remain under item 36.
