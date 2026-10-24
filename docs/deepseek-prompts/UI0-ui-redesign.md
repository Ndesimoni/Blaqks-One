# DeepSeek handoff — UI0: whole-CRM audit and redesign blueprint

Copy the instruction block below into a fresh DeepSeek coding session with access to this repository. The master plan is [Connected CRM UI redesign](../ui-redesign-plan.md). No automated transfer to DeepSeek is implied.

## Copy-ready instruction

You are working on Keys with Simoni / Blaqks One, an existing connected real-estate CRM. The owner says the entire UI is disorganized and not professional, and wants a detailed, consistent redesign. Your assignment is **UI0 only: establish the current baseline and produce an implementation-ready visual/interaction blueprint**. Do not redesign the entire application in one pass or change application code in this packet.

### Read first

1. `AGENTS.md`, `docs/handoff.md`, `docs/token-efficient-delivery.md`.
2. `docs/ui-redesign-plan.md` in full; it defines scope, proposed navigation, patterns, packets and acceptance.
3. `docs/design-standards.md`, the reference-preview section of `docs/design-refresh.md`, `docs/option-overflow.md` and connected sections of `docs/architecture.md`.
4. Relevant feature documentation only as you inventory those features. Current source and as-built feature notes take precedence over obsolete prose about features being unconnected.

For this specific UI assignment, the owner's latest request assigns work to DeepSeek, overriding the old “Claude implements everything” note in `docs/deepseek-delivery-plan.md`. Do not inherit that document's obsolete Arabic/RTL requirements: everything new is English through the existing catalogue; Arabic remains frozen/off. The connected version is the product and the demo is frozen.

### Start safely

- Record current branch/HEAD, `git status --short` and a compact diff summary. Preserve existing edits; a dirty worktree is not permission to reset it or a reason to discard unrelated work.
- At plan preparation, `src/i18n/catalogs/index.js` was modified and `src/i18n/catalogs/en/marketplaceBoard.js` was untracked. These are existing work, not yours. Recheck current state; do not edit, stage or revert them.
- You are not alone in the codebase. Own only the allowed documentation/evidence below. Coordinate a genuine overlapping conflict; continue unaffected read-only work.
- Use synthetic data only. Never print credentials/tokens or capture real client information. Do not migrate/reseed the development database or restart the owner's running services.

### Allowed writes for UI0

- New `docs/ui-redesign-baseline.md`: exhaustive connected route/dialog/state inventory, baseline evidence and implementation impact map.
- New `docs/ui-pattern-spec.md`: concrete target layouts, component/state contracts and pilot acceptance checklist.
- New `docs/screenshots/ui-redesign/` synthetic baseline images with an evidence index in the baseline document.
- Focused additions to `docs/ui-redesign-plan.md` for verified corrections or newly discovered routes; preserve scope and owner decisions.

No writes to `src/`, services, scripts, tests, dependencies, configuration, secrets, migrations or archived/demo sources. Do not edit global roadmap/handoff files while another agent may own them; return the suggested handoff entry in your report. Browser tests may generate their normal ignored artifacts. If current fixtures cannot produce a required state without code changes, document that gap and propose a later test-fixture packet instead of expanding this write set.

### Required work

1. **Inventory the real product.** Trace connected `ServerApp`, session/directory, keyed workspace, shell/content and router. List every current destination and its overlays, primary task/action, actual permissions, read-only variants, component owners, existing tests and availability. Include identity/setup, administration and exceptional/deep-link states, not just visible sidebar pages.
2. **Capture representative current evidence.** Reuse the existing connected disposable-Docker browser harness/fixtures. Capture current shell + Clients + editor/details + Properties + dashboard + Inbox/chat + finance/agreement + marketplace + settings/admin samples, in both themes at 390px and 1280px. Group captures into bounded runs. Record exact role/state/viewport/fixture/test command and whether each image is fresh or historical. Do not claim exhaustive visual coverage from samples.
3. **Classify problems.** For each finding, record source-only versus rendered evidence, affected task, severity, target pattern, preserving-behavior requirement and proposed packet. Avoid subjective “looks bad” descriptions without a concrete hierarchy/interaction problem.
4. **Finalize the target navigation proposal.** Map every current route to a display group from the master plan; distinguish daily work, personal, company and platform settings. Retain exact route identifiers and access predicates. Show Admin, restricted-staff, Super Admin and archived-workspace examples. No new BO1/admin access semantics.
5. **Specify reusable patterns.** Page heading, directory toolbar, filters/chips, tables/cards, selection, pagination, detail/editor, state panel, settings sections and full-height messaging. Reuse existing primitives. Provide anatomy, dimensions/tokens, action order, responsive rules, keyboard behavior and loading/empty/error/conflict/read-only states. Map each pattern to its current source owner.
6. **Provide target wireframes.** Create annotated, code-native/document wireframes for shell + Clients directory + client details/editor at desktop/mobile, with both-theme token notes. Add Properties and Inbox layout stress checks. They are proposed designs, not fake connected features. No new visual framework, decorative stock imagery or image generation is needed.
7. **Map implementation impact.** Trace ordered global and dynamically imported CSS, duplicate selectors, component consumers and shared/demo impacts. Name exact prospective UI1/UI2/UI3 file allowlists, files needing semantic splitting and relevant tests. One coordinator owns shared CSS, catalogue registration and connected navigation.
8. **Record the baseline checks.** Run relevant read-only/local checks where available; clearly separate pre-existing failures, environment blockers and newly introduced documentation problems. Do not fix unrelated baseline failures. Validate new Markdown formatting and local links plus `git diff --check`.
9. **Return a bounded UI1 task.** Include exact allowed files, preserved contracts, non-goals, tests and acceptance. Do not start UI1 until the blueprint/navigation review is complete and implementation is assigned.

### Required preservation checklist

- Same forest-green/neutral/gold identity, system font and light/dark behaviors; no parked palette revival or app/framework rewrite.
- One page title and primary task; no removal of working fields, actions, routes, modules or retained data.
- Workspace resolved before reads; actor/owner separation, assignment visibility, role/action permissions, archived read-only state and correct authorized counts.
- No Super Admin access to private company Inbox/chat/agreement terms; no new messaging/edit controls on restricted shares.
- Existing hash/share links, history, `workspace`/`q` queries, drafts/unsaved guards and conflict/version handling.
- Finance calculations/approvals, immutable agreement/share evidence and payment lifecycle unchanged.
- Grid/table property parity, twelve-per-page, media/floor plans and truthful sample-photo labels.
- Existing centered native Drawer behavior and mobile full-screen treatment; full-height messaging and composer behavior.
- Storage/workbook/backup/import contracts, kept-versus-owned records and source/destination import review unchanged.
- English-only new text; no demo-specific features/tests, external delivery, provider setup, domain purchase, publishing, migrations or commits/pushes.
- No MK3 answers/MK4 deals, public website screens or future account capabilities disguised as design controls.

### Evidence and acceptance

The baseline document must identify current-rendered, source-inferred, historical and unverified findings separately. If Docker/browser access is unavailable, finish the source inventory/wireframes and state exactly which visual checks remain blocked. Do not invent screenshots or report UI0 as fully accepted without its required evidence.

The target blueprint must include:

- An exhaustive route/overlay manifest, with every item assigned a template and implementation packet.
- Desktop/mobile navigation maps, page/form wireframes and exact pilot success criteria.
- Both-theme token/state guidance; keyboard/focus, contrast, long-text and reduced-motion test criteria.
- A Clients pilot target with first record/meaningful state around the first 520px at 390×844, with justified safety exceptions; do not meet it by shrinking type or hiding essential information.
- A component/CSS ownership map, touched oversized-file strategy and explicit UI1–UI3 test allowlists.
- Measurable regression checklist for Admin, restricted staff, Super Admin and archived read-only contexts.

Use the existing runner when appropriate, for example:

```sh
PLAYWRIGHT_CHANNEL=chrome node scripts/test-crm-api.mjs --browser-only navigation.spec.js responsive.spec.js
```

This harness uses disposable PostgreSQL and connected Vite on 5175. Run fixed-port browser suites sequentially. Do not run the frozen demo browser suite as routine verification. Do not run broad application suites just to validate Markdown; record test runs only when they supply baseline/evidence needed for UI0.

### Final report format

```text
Packet: UI0 — complete / partial / blocked evidence
Changed: documentation/evidence files only
Observed: highest-priority verified issues, separately from hypotheses
Checks: exact commands and results; baseline versus new failures
Evidence: screenshot index; viewport/theme/role/state; fresh versus historical
Preserved: contracts checked and limitations
Needs review: proposed navigation + Clients pilot wireframes
Next: UI1 exact task, allowlist and tests — not started
```

Stop after UI0. Do not commit, push, deploy, buy anything, send messages or start the next packet automatically. Never claim the entire redesign is done because the blueprint is complete.
