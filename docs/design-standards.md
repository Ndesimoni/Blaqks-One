# Product design standards

These are required working rules for every agent and contributor to Keys with Simoni. Apply them to every feature, including future screens. Preserve existing CRM behaviour while improving its presentation.

## Approved visual direction

The user-approved [CRM design refresh](design-refresh.md) is the visual baseline for all new and updated screens. Extend its shared patterns consistently. Use the [desktop and mobile reference previews](design-refresh.md#visual-previews) when reviewing a change.

- Preserve the forest-green identity, calm neutral surfaces and restrained warm-gold accents. Dark mode uses green surfaces with gold primary actions; light mode uses white panels with green primary actions. Use the semantic palette in `src/styles/foundation.css` and `src/styles/theme/surfaces.css`.
- Keep layouts compact and useful: clear page titles, concise workspace context, grouped controls, visible results and a clear next action. Give records, priorities and figures visual precedence over decoration.
- Follow the existing system-font typography, 4px spacing scale, aligned controls, rounded panels, thin borders and restrained shadows. Reuse shared styles in `src/styles/system/` so new screens feel like part of the same product.
- Keep scrolling smooth and purposeful. Use natural page scrolling for primary content and bounded scrolling for selectable collections. Keep sidebar settings and modal actions reachable; preserve selection, filters and drafts when content scrolls or collapses.
- Use the shared brief transitions for colour, border and shadow changes, with clear hover, focus and pressed states. Keep controls stable under the pointer and honour reduced-motion preferences for animations and programmatic scrolling.
- Carry the same hierarchy and colours across mobile, tablet and desktop, in both themes. Verify readable contrast, keyboard focus, comfortable touch targets and page reflow against the accessibility rules below.

When an intentional redesign changes this baseline, update the shared rules and reference previews together. Feature additions should build on the approved appearance through the existing tokens and components.

## Design around the task

- Identify the user's task, workspace and next action before changing a screen. Use the current feature and shared component structure.
- Give each page a clear title, useful context and one visually dominant primary action. Group secondary actions and keep destructive actions separate.
- Make the active route, filters, selected records and workspace easy to recognise. Preserve search, selections and drafts through related interactions.
- Use consistent terms: Clients, Leads, Landlords, Properties, Follow-ups, Viewings and Team. Write action labels such as Add property, Save changes and Start message.
- Keep decorative content subordinate to record information and actions. Improve density through grouping, alignment and progressive disclosure.

## Visual consistency

- Use shared primitives in `src/components/ui` and layout components before introducing another button, modal, filter or pagination pattern.
- Use semantic theme tokens for surfaces, text, borders, focus and interaction states. Extend the shared palette when needed; avoid feature-specific hard-coded replacements.
- Dark mode remains the default. Honour the saved preference and verify every changed screen in both themes.
- Use a consistent spacing scale based on 4px increments, existing typography, border radii and icon styles. Give headings, labels, supporting text and values a clear hierarchy.
- Keep form controls and buttons aligned. Use restrained borders and shadows; give hover, focus, selected, disabled and error states distinct treatments.
- Display money, dates, times and phone numbers consistently with the existing UAE formatting helpers. Keep property titles, prices, location and status easy to scan.

## Collections, filters and More

Follow [Clean collection and option browsing](option-overflow.md) and the shared `OverflowList` modes.

| Context                                      | Required pattern                                                                            |
| -------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Main property directory                      | One grid or table, 12 records per page, clear totals and pagination                         |
| Searchable contacts, recipients and activity | One bounded scrolling list with useful search/filter controls                               |
| Compact chips, tags and summaries            | Show up to six; More replaces the preview with one scrollable list containing **all** items |
| Photos and form step navigation              | Horizontal scrolling with visible selection and keyboard access                             |
| Small complete page sections                 | Natural page scrolling without an unnecessary disclosure                                    |

- Expanded More views contain the initial items and the remaining items. Show one close control; avoid duplicate lists, a lingering More button or a second Show more action inside.
- Return to the compact view on Close or Escape. Dismiss a floating selector on outside interaction and after a single choice; keep multi-select pickers open while adding choices.
- Keep the complete collection in state. Collapsing, scrolling, pagination and responsive changes must retain selections and drafts.
- Show active filters, result counts and an easy reset. Distinguish no records from no matching results. Reset/clamp pagination when filters or records change.
- Use extra scroll containers only when they serve a specific task. A primary directory scrolls with the page; selectable/searchable collections may scroll within a panel.

## Forms and overlays

- Group related fields into named sections. Use the existing stepper for forms with several substantial sections; keep short forms on one screen.
- Show the current step and progress, preserve entries when going back, validate the current section before advancing, and provide a review where useful.
- Use persistent labels, required indicators and concise field guidance. Place actionable errors beside the field and focus the first invalid control.
- Use appropriate input types and autocomplete. Allow password managers, paste and autofill in sign-in forms.
- Keep Save, Back and Cancel placement consistent. Protect unsaved work and retain drafts after validation or storage errors.
- Use the shared centred modal for record details and editors. On narrow screens, use the existing full-screen layout with reachable close and action controls.
- Give each modal an accessible title. Keep focus inside it, support Escape, and restore focus to its opener. Route dismissal through the existing unsaved-changes guard.
- Keep the modal body scrollable while its title and actions remain accessible. Ensure sticky controls never cover content, focused inputs or validation messages.

## Accessibility and responsive behaviour

Design and verify against [WCAG 2.2 AA](https://www.w3.org/WAI/WCAG22/quickref/). This is a target requiring verification, not a claim that the current CRM is certified.

- Prefer native buttons, links, inputs, tables and dialogs. Give every control a meaningful accessible name; label icon-only controls.
- Support keyboard navigation, visible focus, logical focus order and screen-reader status announcements. Do not rely on hover, colour or icons alone.
- Check text, control and focus contrast in both themes. Follow the relevant WCAG criteria rather than assuming a token or colour is accessible.
- Use comfortable touch targets, preferably 44px for primary touch controls, and adequate separation. Preserve usable density in desktop tables.
- Make content reflow at narrow widths and browser zoom. Confine necessary wide-table scrolling to the table; the page itself must not overflow horizontally.
- Respect reduced-motion preferences. Keep nonessential animation brief and avoid motion that interferes with reading or input.
- For custom modal interactions, follow the [WAI-ARIA modal dialog pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/).

## Feedback and workspace context

- Define empty, loading, saving, success and failure states wherever the action can produce them. Prevent duplicate submissions while saving.
- Explain errors in plain language and give a useful recovery action. Preserve entered data and the existing storage recovery/export path.
- Confirm destructive actions when data loss requires it. Routine selection, search and navigation should remain direct.
- Keep the active workspace and owner context visible, especially when the Super Admin opens another member's records. Respect the existing scoped data boundaries in lists, reports and recipient searches.
- Label messaging, invitation and authentication prototypes accurately. A local preview cannot show Sent, Delivered or server-verified access when those services are absent.

## File size and architecture

- Every hand-written code file must be **150 physical lines or fewer after formatting**. Count imports, comments and blank lines. Apply this to JSX/JS, styles, data/schema modules, tests, scripts, configuration and backend code.
- Generated artifacts, dependency code, lockfiles and prose documentation are excluded. The archived offline edition is outside the default audit; the same rule applies when changing its hand-written code.
- Extract meaningful feature components, focused hooks, pure selectors/models, service boundaries and named data modules. Share a component when it represents the same behaviour across features.
- Define React components at module scope. Keep imports acyclic and dependencies directed from feature UI toward hooks/models/services.
- Split CSS by responsibility and retain the exact stylesheet import order, selector specificity and theme behaviour. Use `src/styles/index.css` as the ordered entry point.
- Keep test scenarios understandable; use shared fixtures/helpers and separate scenario files by behaviour. Never weaken an assertion to meet the limit.
- Format normally. Do not minify, pack unrelated statements onto one line, strip useful comments or create arbitrary numbered file fragments to satisfy the count.
- Preserve storage keys, record/workbook mappings, backups, calculations, routes and workspace access during a split. Existing oversized files must be split when changed; remaining violations must be reported.

Run `npm run check:lines` for the whole project. It exits unsuccessfully for any oversized first-party file, including retained backend/deferred tests. Dependencies, build outputs and archived offline code are excluded from the default scan. To check a specific file or archived directory, run `node scripts/check-file-size.mjs <path>`.

## Review and verification

1. Inspect the current feature, shared patterns and relevant business/storage contracts before editing.
2. Review the task flow and information hierarchy; implement small, coherent changes without removing working capabilities.
3. Check the changed UI at mobile, tablet and desktop widths, in both themes, with long names, empty results and large collections. Exercise keyboard use and inspect the rendered layout.
4. Test the affected form, navigation, selection, pagination or overlay from start to finish. Include validation, dismissal and failure recovery where relevant.
5. Run `npm run check:lines` and formatting checks. For structural/business changes, run `npm test` and `npm run build`; for UI interactions, run the relevant Playwright scenarios.
6. Report the behaviour changed, verification results and remaining issues. Passing automated tests alone does not establish visual quality or accessibility conformance.

## Applying the rules to the existing project

The initial size audit found 43 oversized frontend files, with more in tests and the retained Calendar backend. These are outstanding work; the new rule does not mean they have already been refactored.

Start with shared surfaces, tokens and controls, then the app shell/navigation, record browsing, editors/details, messaging and team/workspace flows. Split each affected file by responsibility while preserving its current behaviour, then verify the improved flow before moving on. Re-run the checker for the current inventory rather than relying on a static count.
