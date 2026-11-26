# Frontend completion

Scope: finish the audited frontend foundations for the existing browser-local CRM. Preserve all 17 screens, workbook columns, record keys, calculation policies, media, and JSON backup format. Backend/authentication/integrations belong to the next phase.

## Implementation checklist

- Separate records/actions, view state, navigation, and preferences; migrate consumers to focused hooks.
- Add React Router routes that survive reload and support browser history. Use hash URLs so a static host requires no route rewrites.
- Extract property/client/report selectors and record commands from React markup.
- Add shared field validation with inline errors, without making formerly optional fields required.
- Add accessible drawers, focus containment/restoration, keyboard navigation, named controls, and error boundaries.
- Preserve unreadable saved records until the user explicitly chooses recovery; expose failed persistence and retry/export.
- Validate JSON restoration and fix namespace-aware Excel parsing, with original-template coverage.
- Divide CSS into ordered files while preserving the existing cascade; add focused accessibility/recovery styles.
- Verify business rules, malformed data, navigation/history, CRUD, media, backups, Excel, keyboard flows, themes, and mobile layout.

## Proposed boundaries

```text
apps/crm/src/app/                    Routing, providers, application shell
apps/crm/src/hooks/                  Focused context access, orchestration, persistence
apps/crm/src/features/*/selectors.js Feature-specific business selection
apps/crm/src/features/records/       Reusable editor/details/table + validation/commands
apps/crm/src/services/files/         Backup parsing and browser downloads
apps/crm/src/services/storage/       Validated record-envelope persistence
apps/crm/src/components/ui/          Drawer, error boundary, reusable controls
apps/crm/src/styles/                 Ordered original styles + new frontend styles
```

React Router 7.18.4 runs with the existing React 18 application. Node 20 or later is now required; Node 22 is recommended. Vite is updated to 6.4.3. The updates resolve the dependency advisories discovered during this phase, and npm reports zero vulnerabilities. Hash routes provide refresh/history support on static hosting, and the data router supports blocking navigation while edits are unsaved. Drawers follow the [WAI modal dialog pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/) for initial focus, Tab containment, Escape, and focus return.

## Results

The checklist above is implemented. The workspace provider is reduced from 352 to 65 lines of composition; record orchestration lives in dedicated hooks. The shared editor composes reusable field and property media components. Feature-specific selectors cover client matching/timelines, property and record filtering, dashboard/insight aggregation, and date/performance reports.

User-visible fixes include preserving global-search queries on the Client desk, choosing a matching profile, correcting month-end/historical reports, treating percentages/scores and earned currency as numeric fields, clamping pagination after data changes, preserving numeric zero during export, and importing the original namespace-prefixed workbook. Required fields remain limited to record IDs.

Unreadable saved records are retained unchanged behind explicit recovery controls. Failed writes preserve in-memory edits and offer export/retry. JSON imports validate format/version, records, media, and size before replacing data. Existing storage keys, workbook columns, metadata, and full backup version 2 remain intact.

Seven ordered stylesheet files preserve all 667 original top-level rules, selectors, declarations, and at-rules in the same order. A separate frontend stylesheet adds dialogs, error/recovery states, focus styling, and reduced-motion support. Theme/mobile browser screenshots accompany the regression results. Feature screens and Excel/JSZip load on demand.

The browser-local frontend phase is complete. Shared data, login/permissions, cloud media, automatic backups, notifications, and integrations remain backend/product work. This edition uses manual full backups and does not synchronize concurrent browser tabs. Existing styling overrides are preserved in their original order; this phase does not redesign the UI or remove workbook features.

## Final verification

| Check                                        | Result                                                                         |
| -------------------------------------------- | ------------------------------------------------------------------------------ |
| `npm test`                                   | 35 unit/contract/smoke checks passed                                           |
| `PLAYWRIGHT_CHANNEL=chrome npm run test:e2e` | 19 browser checks passed on the patched dependencies                           |
| Targeted mobile screenshot refresh           | 2 affected browser checks passed                                               |
| `npm run build`                              | Passed with Vite 6.4.3; feature/Excel chunks emitted                           |
| `npm run format:check`                       | Passed                                                                         |
| Dependency installation audit                | 0 reported vulnerabilities                                                     |
| Syntax/import/unused-symbol diagnostics      | 0                                                                              |
| Original CSS comparison                      | All 667 original top-level rules preserved in order                            |
| Source compatibility check                   | Workbook schemas, demo data, original calculation/media/date helpers unchanged |
| Local documentation links                    | All resolve                                                                    |

Browser coverage includes all 17 screens; CRUD and reload persistence for all 11 record modules; property filters, sorting/pagination and media; JSON backup/restore; app-exported Excel and the original prefixed template; numeric zero, rich text and date import; invalid file rejection; malformed storage recovery/download; quota failure and retry; client search; URL/history/unknown routes; keyboard focus wrapping/restoration; unsaved-edit protection; real render-error recovery; preferences; and mobile light/dark layouts.

The build emits two harmless React Router `use client` directive warnings: this Vite application runs entirely in the browser, so those React Server Component directives are ignored. There are no application build errors. The preserved offline implementation was not changed.
