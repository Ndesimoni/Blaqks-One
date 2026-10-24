# DeepSeek handoff — UI1: shared UI foundations

Copy the instruction block below into a fresh DeepSeek coding session with access to this
repository. UI0 produced the baseline and target patterns; this packet implements only the small
shared foundation needed by later screen packets.

## Copy-ready instruction

You are working on Keys with Simoni / Blaqks One, an existing connected real-estate CRM. Your
assignment is **UI1 only: strengthen the shared button, badge, pagination and empty-state
foundations in both themes without redesigning any product screen**. Stop after this packet.

### Read first

1. `AGENTS.md`, `docs/handoff.md` and `docs/token-efficient-delivery.md`.
2. `docs/ui-redesign-plan.md`, `docs/ui-redesign-baseline.md` and
   `docs/ui-pattern-spec.md`, especially pattern spec §§4–5, §8 and §9.3.
3. `docs/design-standards.md` and the reference-preview section of
   `docs/design-refresh.md`.
4. The allowed source files and their consumers before editing them.

The connected version is the product; the browser-local demo is frozen. Everything new is
English through the existing catalogue. Preserve the current forest-green, neutral and gold
identity. Do not add dependencies, a component library, new fonts or new icons.

### Start safely

- Record the branch/HEAD, `git status --short` and `git diff --stat`. Preserve all existing and
  untracked work. Do not reset, clean, stage, commit or push.
- You are not alone in the repository. Edit only the allowlist below. If another agent is editing
  an allowed file, stop on that file and report the overlap.
- Treat the UI0 documents and screenshots as existing owner work. Do not rewrite or delete them.
- Use fictional data and the disposable connected test database only. Do not migrate or reseed the
  development database, restart the owner's services or use real client information.

### Exact write allowlist

- `src/components/ui/Button.jsx`
- `src/components/ui/Badge.jsx`
- `src/components/ui/Pagination.jsx`
- `src/components/ui/Empty.jsx`
- `src/styles/ui/buttons.css`
- `src/styles/ui/badges.css`
- `src/styles/ui/pagination-empty.css`
- `src/styles/ui/accessibility.css`
- `src/styles/system/controls.css`
- New `tests/unit/ui-foundations.test.js`
- New screenshots only under `docs/screenshots/ui-redesign/ui1/`
- A short `UI1 as built` addition to `docs/ui-pattern-spec.md`

Do not edit `src/styles/index.css`: all allowed styles are already imported. Do not edit the
English catalogue unless you first find a genuinely new user-facing string that cannot remain a
component prop; report that finding instead of expanding the allowlist.

Every changed hand-written code or test file must remain at 150 physical lines or fewer after
formatting. Split no unrelated file and do not compress formatting to meet the limit.

### Required implementation

1. **Button contract**
   - Preserve every existing prop and variant (`primary`, `light`, `outline-light`,
     `danger-light`) and all caller-supplied attributes.
   - Keep visible focus, disabled, hover and active states distinct in light and dark themes.
   - Preserve a 44px touch target. Do not animate position on hover. An icon must remain
     decorative when the visible label names the action.
   - Do not introduce icon-only use or infer an accessible name.
2. **Badge contract**
   - Preserve `statusClass`, explicit `tone` precedence and current fallback behavior.
   - Keep status text, not colour alone, as the meaning. Make all four tones readable in both
     themes using semantic tokens or deliberate theme overrides.
   - Keep compact dimensions without using 9px text.
3. **Pagination contract**
   - Preserve zero-based `page`, the default 12-item page size, `collection`/`table` variants,
     range calculations and `onChange` behavior.
   - Provide an accessible navigation label fallback when callers omit `label`; keep current page
     text understandable to assistive technology.
   - Disabled Previous/Next controls must be visibly and programmatically disabled. Keep the
     pager usable at 320–390px without page-level horizontal overflow.
4. **Empty-state contract**
   - Preserve current props and custom action rendering.
   - Give the state a clear readable title/detail hierarchy in both themes. Do not claim the user
     can create or retry unless the caller supplies that truthful copy/action.
   - Keep it compact enough for directory and panel use; do not turn it into a decorative hero.
5. **Shared accessibility styling**
   - Use the existing semantic colour variables from the approved themes. Remove hard-coded
     light-only colours only within the allowed files.
   - Ensure keyboard focus is visible for buttons as well as links. Respect reduced motion.
   - Verify contrast for body-size badge, pager and empty-state text in both themes; record the
     measured pairs and ratios in the as-built note.
6. **Focused tests**
   - Add unit coverage for Button attribute forwarding/disabled state, Badge automatic and
     explicit tones, Pagination zero/one/multiple-page boundaries and Empty custom action/defaults.
   - Follow the repository's existing React test approach; do not add a test dependency or create
     a private component showcase route.
7. **Rendered evidence**
   - Reuse existing connected fixtures/screens that naturally contain these primitives. Capture
     representative 390px and 1280px images in light and dark under the UI1 screenshot folder.
   - Record the role, state, viewport, theme and exact command in the as-built note. Do not edit a
     feature page merely to force every primitive into one screenshot.

### Preserved contracts and non-goals

- No screen, shell, navigation, route, form, record field, data hook, service, API, permission,
  workspace rule, storage/import/export format or business workflow changes.
- No UI2 navigation work, UI3 Clients pilot, broad typography/spacing reset, new state-panel
  abstraction or restyling of every consumer.
- No demo feature/test changes, Arabic/RTL work, backend/Rust/database changes, migrations,
  provider connections, delivery, marketplace MK3/MK4 or public-site work.
- Do not change badge business classification beyond the existing `statusClass` outcomes.
- Do not hide labels, counts or controls to make screenshots look cleaner.

### Checks

Run focused checks first, then the packet checks:

```sh
node --test tests/unit/ui-foundations.test.js
npm test
npm run build
npm run check:i18n
npm run check:lines:ci
npm run check:boundaries
npx prettier --check \
  src/components/ui/Button.jsx \
  src/components/ui/Badge.jsx \
  src/components/ui/Pagination.jsx \
  src/components/ui/Empty.jsx \
  src/styles/ui/buttons.css \
  src/styles/ui/badges.css \
  src/styles/ui/pagination-empty.css \
  src/styles/ui/accessibility.css \
  src/styles/system/controls.css \
  tests/unit/ui-foundations.test.js \
  docs/ui-pattern-spec.md
git diff --check
```

Use one existing focused connected browser spec for rendered evidence when its fixtures cover the
states you need. Run fixed-port browser checks sequentially with `PLAYWRIGHT_CHANNEL=chrome`.
Do not run the frozen demo `npm run test:e2e`. Full API and connected-browser suites remain CI's
job. Run `npm run check:lines` only to report the existing repository inventory; do not claim it
passes unless it exits successfully.

### Acceptance

- Existing consumers compile without call-site edits and retain their behavior.
- The four primitives have coherent normal, hover, focus, active and disabled/state treatment in
  both themes, with no page-level overflow at 390px.
- The unit test covers the stated contracts and all changed code/test files meet the 150-line rule.
- Required packet checks pass, or each pre-existing/environment failure is identified precisely.
- Evidence and the as-built note distinguish automated, rendered and unverified claims.
- No file outside the allowlist is changed by UI1.

### Final report

```text
Packet: UI1 — complete / partial / blocked
Changed: allowlisted files only
Preserved: component APIs and product contracts checked
Checks: exact commands and pass/fail results
Evidence: viewport/theme/role/state and screenshot paths
Contrast: measured pairs and ratios
Problems: pre-existing failures, environment blockers and unresolved findings
Next: UI2 connected shell — not started
```

Stop after UI1. Do not start UI2, commit, push or deploy.
