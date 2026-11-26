# Frontend architecture audit and refactoring plan

Audit date: October 8, 2026. Scope: the active React 18/Vite frontend, its business rules, styles, persistence, and tests.

## Existing architecture

The earlier folder reorganization already established feature pages, shared UI/layout components, schema/configuration modules, and business helpers. Continue from that structure.

`apps/crm/src/main.jsx` mounts `App` in React Strict Mode. `WorkspaceProvider` supplies one context to the application shell and feature pages. `App` selects the current screen through an in-memory route string. Ten data-entry screens share the record directory/table; Properties has a dedicated directory. The shared record editor and detail panel receive their records and callbacks through props.

The schema retains 11 editable modules and 211 fields, including the enhanced property fields. Six report/workflow screens complete the 17-section application. Field names become normalized record keys, while workbook column letters preserve Excel compatibility.

Business helpers already cover lead scoring, commission splits, receipts, reminders, property purpose/pricing, and calculated fields. Additional selection logic remains in the provider and feature pages. Photos and plans are validated/compressed through browser APIs and stored in record payloads. Excel import/export uses JSZip and spreadsheet XML; full JSON backup includes media.

The stylesheet has semantic surface tokens, light/dark themes, global UI classes, and responsive breakpoints. It also retains successive v1.1 and v1.2 overrides, so source order matters.

## Findings and priorities

| Priority | Evidence before this stage                                                                                                               | Effect                                                                                                               | Planned response                                                                                      |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| High     | `WorkspaceProvider.jsx` is 440 lines and owns storage reads/writes, preferences, summaries, search, CRUD, imports, backups, and UI state | Data access and business selection cannot be exercised independently of React orchestration                          | Stage 1: extract storage repositories, persistence hooks, and workspace selectors                     |
| High     | One context exposes records, preferences, filters, actions, and transient UI state; its object is recreated on each provider render      | Every consumer can rerender when unrelated UI state changes                                                          | Later: split data/actions, preferences, and navigation contexts after consumer migration tests        |
| High     | Stored JSON is parsed without validating the full record envelope                                                                        | Unexpected stored shapes can fail during rendering; current parse-error fallback behavior can replace malformed data | Preserve existing load behavior in Stage 1; design explicit recovery and migration before changing it |
| Medium   | Client matching, property filtering, and report aggregation are embedded in feature pages                                                | Important business policies remain coupled to JSX                                                                    | Later: extract feature selectors with fixture tests before changing policies                          |
| Medium   | `styles/index.css` is 4,467 lines, with repeated token/theme declarations and successive overrides                                       | Reordering styles can change desktop, mobile, or dark-mode behavior                                                  | Later: introduce ordered stylesheet boundaries backed by visual baselines                             |
| Medium   | `ErrorBoundaryFallback` is only a rendered message, and is used for an unknown route                                                     | It does not catch component exceptions                                                                               | Later: add a real React error boundary with a recovery flow                                           |
| Medium   | Record drawers lack dialog semantics/focus management; several icon-only controls lack accessible names                                  | Keyboard and screen-reader use needs stronger support                                                                | Later: extract an accessible drawer primitive and verify focus/escape behavior                        |
| Medium   | Form, backup, and Excel validation are distributed; browser alerts/confirmations report errors                                           | Error handling and validation are difficult to reuse                                                                 | Later: extract record commands and file services, then introduce structured validation                |
| Medium   | Excel XML lookup uses qualified tag names; the original template contains XML prefixes                                                   | Original-template parsing needs a dedicated regression test beyond the existing app-export round trip                | Later: characterize the importer before changing its XML handling                                     |
| Low      | `AGENTS.md` still names removed flat source files                                                                                        | Future changes may target obsolete entry points                                                                      | Update only the current structure section and the visibly duplicated trailing text                    |

These findings describe maintainability work. The current browser-local MVP still requires the planned backend, authentication, and storage work before becoming a secure multi-user product.

## Proposed structure

Retain the established feature folders and add a persistence boundary:

```text
src/
  app/                      Application composition and workspace orchestration
  components/
    layout/                 Persistent application chrome
    ui/                     Reusable visual primitives
  config/                   Field, navigation, theme, and storage constants
  data/                     Workbook schemas and demo records
  features/<feature>/       Feature pages and, in later stages, local hooks/selectors
  hooks/
    useWorkspace.js         Existing consumer contract
    useWorkspaceData.js     Record-envelope state and persistence
    useWorkspacePreferences.js
                            Preferences persistence and theme synchronization
  lib/
    workspace.js            Workspace summary and record search/sort selectors
    ...                     Existing business and file utilities
  services/
    storage/
      workspaceRepository.js
                            Read/write the existing CRM record envelope
      preferencesRepository.js
                            Read/write the existing preference payload
  styles/                   Existing ordered stylesheet; split in a later stage
tests/
  unit/                     Business, selector, and repository contract tests
  browser/                  CRM interaction and persistence regression checks
  smoke/                    Preserved offline checks
```

Avoid creating empty placeholder folders. Add feature-owned hooks/selectors as they are extracted. Introduce React Router in its own later stage, followed by asynchronous service contracts for the planned Rust Axum/PostgreSQL backend.

## Stage 1 scope

1. Add explicit workspace and preference repositories with injectable storage access for tests. Module imports must not access browser storage.
2. Move React persistence effects into dedicated data and preference hooks.
3. Extract the existing workspace summary and record search/sort behavior into non-React selectors.
4. Keep `useWorkspace()` and the provider's context fields compatible so existing pages require no migration.
5. Preserve storage keys, record envelope metadata, demo behavior, field mappings, media payloads, backup formats, calculation rules, alerts, and preference fallbacks.
6. Add contract tests for existing saved data, malformed/blocked reads, failed writes, linked-record search, sorting, summaries, and non-mutation. Extend browser coverage for preference persistence and storage failures.

Styles, page markup, record commands, media handling, and Excel/JSON implementations remain separate later refactoring stages. The repository methods are synchronous for the current browser implementation; an HTTP-backed implementation will also need explicit asynchronous loading and error states.

## Verification

The baseline `npm test` run passed all nine existing unit/smoke checks. After implementation, run the expanded unit/smoke suite, the browser suite using the installed Chrome, the production build, and formatting checks. Verify the original stylesheet is byte-identical to the audit snapshot.

## Stage 1 result

Implemented the two storage repositories, the data/preferences hooks, and the workspace summary/search selectors. `WorkspaceProvider.jsx` now delegates those responsibilities and retains the existing context API. It decreased from 440 to 352 lines. Search callbacks remain stable while their data/query/sort inputs are unchanged.

The current project paths in `AGENTS.md` and the developer documentation now match the code. The feature pages, shared UI/layout components, schemas, existing business helpers, media/Excel code, and stylesheet are byte-identical to the pre-refactor snapshot. This stage added no dependencies.

| Check                                        | Result                                                               |
| -------------------------------------------- | -------------------------------------------------------------------- |
| `npm test`                                   | 22 unit/contract/smoke checks passed                                 |
| `PLAYWRIGHT_CHANNEL=chrome npm run test:e2e` | 8 browser checks passed                                              |
| `npm run build`                              | Production build passed                                              |
| `npm run format:check`                       | Passed                                                               |
| Import/syntax diagnostics                    | No unresolved symbols/imports or syntax errors                       |
| Source preservation check                    | All pre-existing source files except the provider are byte-identical |
| Documentation links                          | All local links resolve                                              |

Browser checks covered all 17 screens, record creation/editing/deletion, property filtering/search/pagination, property photos, JSON backup/restore, app-exported Excel round trips, existing mobile browser data, theme/target persistence, and simulated storage write failures. Original-template Excel import is still a separate audit finding; serving/downloading that file was verified.

The next stage should separate workspace contexts by responsibility and extract feature selectors/record commands under characterization tests. Accessibility/error recovery, stylesheet layering, importer compatibility, and asynchronous backend integration remain the later items listed above.

## Frontend completion follow-up

The subsequent frontend phase addresses context separation, routed feature loading, feature selectors/record commands, validated storage recovery, real error boundaries, accessible drawers, structured form/backup validation, namespace-aware template import, and ordered stylesheet files. The historical findings above describe the pre-refactor baseline; consult [Frontend completion](frontend-completion.md) and the updated [Architecture](architecture.md) for the current implementation and verification. Backend integration remains a separate phase.
