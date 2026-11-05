# Deferred Calendar scenarios

`calendar.spec.js` retains the previous integration flows as reference for the future Calendar phase. It is outside Playwright's active `apps/crm/tests/browser` directory. Restoring these scenarios requires restoring the Calendar route, connection context, integration controls and an isolated companion test server.

The current frontend suite runs with Vite alone. `apps/crm/tests/browser/local-scheduling.spec.js` verifies that Calendar is absent, no Calendar requests run, and local appointments and saved integration metadata survive edits. Pure scheduling and backup contracts still run in `apps/crm/tests/unit/calendar.test.js`.
