# Blaqks One product vision and feature roadmap

Status: owner brainstorm, 2026-10-16. **Goal: make Blaqks One the number one software for real estate**, starting with UAE brokerages. A module for property developers follows later. Each feature below is planned, not built. Every item gets its own design (and, where needed, security) review before it is built, and features are delivered one at a time, finished, polished and tested. Owner decisions are in [Product decisions](product-decisions.md), and queued work is in the [roadmap](claude-implementation-roadmap.md#15-remaining-connected-crm-work-outside-the-integrations).

## What makes us different

- **Evidence-backed deals.** Cross-company agreements and deal-room chat replace verbal promises; see [Cross-company deal agreements](product-decisions.md#cross-company-deal-agreements-decided-2026-10-15-planned).
- **Multilingual by design.** The interface, messages and calls work in each person's own language.
- **Built for the UAE.** RERA and ADREC licences, DLD fees, VAT, UAE PASS, Dubai time and Arabic right-to-left layout.
- **Premium, calm design** that agents enjoy using every day.

## Planned features

### 1. Premium redesign of the whole app

The owner wants the CRM to look orderly, premium, clean, smooth and "expensive", especially the Dashboard, with charts and diagrams.

- **Approach:** the senior product designer proposes two or three visual directions (colour, typography, depth, motion and chart style) as preview pages. The owner picks one, and it becomes the new approved baseline in `docs/design-standards.md`, replacing the current one only with the owner's approval. **Chosen 2026-10-16:** [Design system v2 · Midnight](design-system-v2.md).
- **Design system v2:** tokens, components and chart components shared by every screen, and ready for right-to-left layout (see feature 2).
- **Dashboard:** KPI cards with trends, a pipeline funnel, lead sources, deals and fees over time, team performance, a schedule overview and a finance summary. Each view respects permissions, with skeleton loading and both themes.
- **Charts:** choose either light hand-built SVG charts (as in Performance today) or one small, well-maintained chart library. This is justified in the design phase; avoid heavy dependencies.
- **Rollout:** screen by screen, Dashboard first, with behaviour unchanged.

### 2. Language preference for every user

- **Choice:** each user picks their language in My profile, and the whole interface appears in that language.
- **Languages:** start with **English and Arabic**, including full right-to-left layout. Then add French, Russian and others by demand (Hindi, Urdu, Chinese and Persian are common in UAE real estate).
- **Messages:** a colleague's message in English appears **translated into the reader's language**, with a "Show original" option. AI translation is labelled as such.
- **Record content:** client notes and property descriptions are translated on request, not automatically. Legal and contract texts always keep the original.
- **Foundation:** move every interface text into translation catalogs, use layout rules that work in both directions, and format dates, numbers and AED for each language.
- **Timing:** build the foundation **early**. Every new screen built before it makes the change more expensive.

### 3. Messaging and deal rooms

- **Inside a company:**
  - team channels, which the whole team can see ("public");
  - direct messages ("private");
  - mentions, attachments (object storage), notifications and read receipts.
- **Between companies:** a **deal room** for each joint deal, combined with cross-company agreements. Messages there are **locked once sent** (edits are shown as edits), so the conversation becomes part of the evidence trail.
- **Technical:** WebSockets on Axum, plus Valkey/Redis once there is more than one server. A separately owned `messaging/` module with its own tables (see [Service boundaries](service-boundaries.md) rule 9). Message bodies never enter activity logs.
- **Rules to decide:** who can read what, retention periods and moderation, in line with UAE data-protection law.

### 4. Field hints for new users

- **Behaviour:** a short hint appears when a field gets focus, like the navigation tooltips, and disappears when typing starts.
- **Who sees them:** hints are on for new accounts and can be switched off in My profile. An ⓘ icon keeps each hint available afterwards.
- **Content:** one central hint catalog, so wording stays consistent and translatable.
- **Accessibility:** screen readers announce each hint (`aria-describedby`).
- **Order:** start with the most-used forms (Clients, Properties, Deals, Payments).

### 5. AI assistant (floating, text and voice)

Built in three levels:

1. **Help and navigation:** "take me to my overdue follow-ups", "how do I hand over a deal?". No client data is sent to the AI.
2. **Questions about your data:** the assistant queries the CRM **as that user**, through the same APIs and permissions, never directly from the database.
3. **Actions:** for example "create a follow-up with Ahmed tomorrow at 10", always with a confirmation before saving.

Other points:

- **Voice:** use a proper speech-to-text service with good English and Arabic support. The browser's built-in recognition is limited.
- **Before levels 2 and 3:** the owner must decide on data handling for sending CRM data to an AI provider, and customers must be told clearly. Usage cost is per request.

### 6. Calculators

- **Commission calculator:** next to the share and commission fields, using the **same calculation engine as the server**, so the figures always match.
- **UAE set:**
  - VAT 5%;
  - DLD transfer fee (4%) and agency fee;
  - mortgage repayments;
  - rental yield and ROI;
  - off-plan payment plans.
- **Public website:** some calculators can also go on the public website, where they attract leads.

### 7. Video calls with live AI translation

- **Goal:** each person speaks their own language and hears, and reads, the other in theirs. For example, an English-speaking agent with an Arabic- or Russian-speaking client.
- **Build:**
  - use a managed WebRTC/SFU service (for example LiveKit, which supports AI agents) instead of building media handling ourselves;
  - the Rust backend handles users, permissions, invitations and call records;
  - real-time speech translation comes from a provider (OpenAI Realtime or Azure Speech, to be evaluated).
- **Stages:**
  1. One-to-one calls.
  2. Live **translated captions**, cheaper and more accurate.
  3. Translated voice.
  4. Group calls.

  Start with English and Arabic, then Russian and French.

- **Cautions:**
  - Prices, dates and unit numbers are always shown as captions, not audio only.
  - Translation adds about 1–3 seconds of delay.
  - Per-minute AI and bandwidth costs make this a candidate premium-plan feature.
  - **UAE VoIP regulation must be checked before launch.**
  - Recording or transcription needs everyone's explicit consent.

### 8. Already planned elsewhere

- **Blaqks One platform:** admin dashboard, public sign-up, password recovery, two-step login and hosting.
- **Public website, plus optional per-company websites.**
- **Social media connections and WhatsApp/email,** then **AI lead agents** with human review.
- **Mobile app.**
- **Developers module** for off-plan projects, inventory and payment plans (later).

## Suggested order

1. **Premium redesign direction and design system v2** (right-to-left ready), with the Dashboard first.
2. **Language foundation:** English and Arabic.
3. **Platform foundation:** Blaqks One admin dashboard, public sign-up, recovery, two-step login and hosting.
4. **Quick wins:** field hints and calculators.
5. **Deal rooms:** cross-company agreements, chat and evidence.
6. **Internal messaging,** then WhatsApp, email and social connections.
7. **AI assistant,** levels 1, then 2, then 3.
8. **Video calls with translation,** in stages.
9. **Later:** mobile app, AI lead agents and the developers module.

Items 1–3 can run in parallel lanes. Design and language work do not block the platform backend.

## Risks to manage

- **Spreading too thin:** finish each feature before starting the next.
- **AI costs and data handling:** owner decisions are needed before any client data reaches an AI provider.
- **Regulation:** UAE data protection, VoIP rules, consent for recordings and transcripts, and RERA rules on commission sharing.
- **Translation accuracy:** always offer the original text and show key figures as text.
