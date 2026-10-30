# CRM design refresh

This stage implements the shared product design standards across the active frontend. It improves the presentation and interactions while retaining record, workbook, backup and workspace contracts.

## Changes

- A consistent green and neutral palette, restrained gold actions, readable status colours and matching surfaces in light/dark mode.
- Clearer typography and a shared spacing/control scale. Buttons use stable hover/press states, visible keyboard focus and comfortable touch targets.
- Compact workspace context and page headings. Dashboard priorities and figures take precedence over the former decorative welcome banner.
- A sidebar with independently scrolling CRM links and persistent settings/profile controls.
- A smaller property summary, visible search/results, responsive cards and expandable advanced filters. Mobile filters initially collapse and retain values while closed.
- Mobile workspace search, keyboard shortcuts and predictable dismissal. Search continues into the existing Client desk with its query preserved.
- Consistent fields, modal surfaces, section navigation and reachable form actions. The full-screen mobile editor retains its existing draft/validation protections.
- Subtle colour, border and shadow transitions. Scroll containers use consistent scrollbars; navigation/pagination scrolling and animations respect reduced-motion preferences.

## Code organisation

`apps/crm/src/app/App.jsx` owns providers and routing. `WorkspaceLayout.jsx` composes the shell; `WorkspaceNotices.jsx`, `WorkspaceNotifications.jsx` and `WorkspaceDialogs.jsx` own recovery notices, transient feedback and shared overlays/file inputs.

`PageHeading.jsx` delegates file actions to `DataExportMenu.jsx`. `WorkspaceSearch.jsx` owns keyboard/mobile search presentation without moving records or changing search contracts.

The dashboard and property directory now compose focused feature components. `usePropertyDirectory.js` retains selection, filter/pagination reset and last-page clamping logic. Card and table views share the existing page state.

`workspace.css`, `theme.css`, `frontend.css` and `listing-media.css` are ordered import manifests for named responsibility-based styles. Shared product contracts load through `system.css` after feature styles; their specificity matches existing theme rules. Palette and body defaults belong to `foundation.css` and `theme/surfaces.css`.

All code files created or changed in this stage must meet the 150-line rule. Unrelated older oversized modules remain visible in `npm run check:lines`; a successful focused check does not mean the full repository has passed.

## Verification

- Existing unit/storage/workbook tests and the production build.
- Existing Playwright CRM, form, messaging, workspace and team scenarios.
- Browser design checks across the 19 CRM routes and available settings at 1440px, 768px and 390px in both themes; browser exceptions and page overflow fail the checks.
- Interaction checks for mobile search, expandable filters and retained values, stable hover geometry, shared text contrast and reduced-motion settings.
- Screenshot inspection of dashboard, directories, messaging and mobile editors. These checks cover the changed flows; they do not establish complete WCAG conformance.

## Recorded results

- `npm test`: 80 tests passed.
- The full browser run passed 77 of 78 scenarios. The remaining scenario reused a sign-out link after its menu closed. It was updated to assert dismissal and reopen the menu, preserving both cancellation and confirmation checks. All eight authentication scenarios passed on rerun; no unresolved browser failures remain from this stage.
- All six design tours passed: 22 routes at each of three viewport widths in both themes. All three design interaction scenarios passed.
- `npm run build` and `npm run format:check` passed.
- The focused code-size checks passed for the changed/refactored files. The repository audit still fails for 53 older files, down from 62 before this stage. These remain outstanding refactoring work.

Authentication scenarios now live in `sign-in.spec.js`, `session.spec.js` and `sign-out.spec.js`, each within the file-size limit.

## Visual previews

- [Desktop dashboard, dark mode](screenshots/design-overview-dark.png)
- [Desktop properties, light mode](screenshots/design-properties-light.png)
- [Mobile properties, light mode](screenshots/design-properties-mobile.png)
- [Mobile property form, dark mode](screenshots/design-property-form-mobile.png)
