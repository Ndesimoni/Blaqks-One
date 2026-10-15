# Getting started in VS Code

The active application is a React 18 + Vite project. It includes 19 CRM screens and four settings/workspace screens covering the original workbook, local schedules, messaging previews, team access, private workspaces, activity history, light/dark mode, property media, Excel interoperability, and browser-local records. Google Calendar is deferred while frontend development continues.

## Start the app

The product is the connected CRM: the React frontend, the Rust CRM API and PostgreSQL in Docker. You need Node.js 20 or later (Node 22 recommended), Rust 1.89 or later and Docker Desktop.

### First-time setup

Run these once, from the project folder:

```bash
npm install            # install frontend packages
npm run setup:crm      # create the private .env (random database password, connected mode)
npm run db:up          # start PostgreSQL in Docker
npm run crm:create-user  # create your first account (Super Admin or Admin), hidden password prompt
```

Optional, to fill your local workspace with clearly fictional test data:

```bash
npm run db:mark-dev       # once: mark this database as a development database
npm run crm:sample-data   # add sample records
npm run crm:clear-sample  # remove them again
```

### Every day

Start Docker Desktop first, then use three terminals (**Terminal → New Terminal**) in the project folder:

```bash
# Terminal 1 — database
npm run db:up

# Terminal 2 — CRM API on 127.0.0.1:8788 (applies new database migrations on start; keep it running)
npm run dev:api

# Terminal 3 — website on 127.0.0.1:5173 (keep it running)
npm run dev
```

Open <http://127.0.0.1:5173> and sign in with the account you created. To stop, press **Ctrl+C** in terminals 2 and 3, then run `npm run db:stop`; your data stays in the Docker volume.

After pulling new code, restart `npm run dev:api` so new migrations apply, and run `npm install` if `package.json` changed.

### Frozen demo

The browser-local demo has been frozen since 2026-10-14 and is no longer developed. With `VITE_CRM_MODE=demo` in `.env`, `npm run dev` starts it alone; sign in with `aidah@keyswithsimoni.test` or `simoni@keyswithsimoni.test` and the public demo password `SimoniDemo2026!`. See [Frontend sign-in](frontend-sign-in.md).

Save source changes to see Vite update the browser. For Chrome debugging, choose **Run and Debug → Run CRM in Chrome**. Build and test tasks are available under **Terminal → Run Task**.

## Where to work

| Change                                      | Location                                               |
| ------------------------------------------- | ------------------------------------------------------ |
| Application composition                     | `src/app/App.jsx`                                      |
| Workspace orchestration                     | `src/app/WorkspaceProvider.jsx`                        |
| Record actions and file handlers            | `src/hooks/useRecordActions.js`                        |
| Routes and feature loading                  | `src/app/FeatureRoutes.jsx` and `src/config/routes.js` |
| Record and preference persistence hooks     | `src/hooks/`                                           |
| Browser storage reads and writes            | `src/services/storage/`                                |
| A specific screen                           | Its folder under `src/features/`                       |
| Header or sidebar                           | `src/components/layout/`                               |
| Shared visual control                       | `src/components/ui/`                                   |
| Field options or navigation                 | `src/config/`                                          |
| Workbook field mapping                      | `src/data/schemas.js`                                  |
| Fictional demo records                      | `src/data/demo.js`                                     |
| Business calculations or file import/export | `src/lib/`                                             |
| Theme, spacing, or responsive styles        | Ordered files imported by `src/styles/index.css`       |
| Favicon or downloadable workbook            | `public/`                                              |

Read [Architecture](architecture.md) for the full module map.

## Verify changes

```bash
npm run format:check
npm test
npm run build
npm run check:lines
npm run test:api
PLAYWRIGHT_CHANNEL=chrome npm run test:server:e2e
```

`test:api` and `test:server:e2e` use their own disposable Docker database and a test API on port 8790; they never touch your development data. `PLAYWRIGHT_CHANNEL=chrome` uses your installed Google Chrome (or run `npx playwright install chromium` once). Do not run the frozen demo suite (`npm run test:e2e`) as a routine check.

## Existing records and backups

The previous shared records remain under the existing storage key in the Super Admin organisation workspace. Each member has separate record/target keys; Aidah's personal records are fresh fictional examples, and other profiles start empty. The backup format stays compatible. Browser records remain local to the browser and origin where they were entered. Changing browser, hostname, or port creates a separate storage workspace. See [Private workspaces and team activity](private-workspaces.md).

Use **Data & export → Full backup with photos (JSON)** to preserve records and attachments. Excel exports include listing fields and reports, while full JSON backups include photos and floor plans.

Sections use hash URLs (`/#/clients`, `/#/properties`, etc.) that survive reload on static hosting. Malformed saved records open a recovery screen with the original data available for download. A failed write shows **Export full backup** and **Retry saving** controls; export before closing if retry still fails. The browser-local edition requires manual backups and does not synchronize between devices or browser tabs.

## Offline edition

The earlier zero-install app is preserved under `legacy/offline/`. Run `npm run offline` to serve it on port 4173, or see its [README](../legacy/offline/README.md). Develop the modern application in root `src/`.
