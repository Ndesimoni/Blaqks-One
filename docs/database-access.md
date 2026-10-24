# Database access rules (DB1)

Status: planned 2026-10-24; queued for the hosting phase (owner: "we would look at it when
we are about to host the platform"). Not built. Needs a security review before it is built,
like other access work.

## Why

Today the API, the worker and the migrations all connect as one PostgreSQL superuser
(`kws_crm` in `compose.yaml`), and no migration grants or revokes anything. The insert-only
triggers on the evidence tables (agreement revisions, events, actions and payments; listing
snapshots and share events; marketplace applications, decisions, terms, acceptances, consents and events) stop mistakes in our own code, but a superuser can switch
triggers off, change or drop tables and empty them. If the running app were compromised, so
would the evidence be.

## Plan: three roles with different powers

| Role           | Used by                                    | Can do                                                                                                                                                        |
| -------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Owner          | Only the migrate command, during a release | Owns the schemas and tables, creates and changes them, sets the grants. Not a superuser and never used by the running app.                                    |
| App            | The API and the worker                     | Reads and writes records within its grants. Evidence tables: `SELECT` and `INSERT` only. No `ALTER`, `DROP`, `TRUNCATE`, trigger changes or replication role. |
| Platform admin | A person, for emergencies only             | The hosting provider's administrator login. Never stored in the app or its configuration.                                                                     |

## How it is built (one packet)

1. **Roles:** an idempotent setup command creates the owner and app roles. Docker runs it for
   development and the disposable test database; it runs once on the hosted database.
   Existing development volumes are kept.
2. **Grants in a migration:** each schema and table gets exactly what the app needs.
   Evidence tables get `SELECT, INSERT` only. Tables whose rows legitimately change (such as
   an agreement's state or a listing share's status) get `UPDATE` on those columns only,
   with their guard triggers still in place. `ALTER DEFAULT PRIVILEGES` gives every new
   table no access until a migration grants it, and `PUBLIC` loses its default rights.
3. **Two connection settings:** `CRM_DATABASE_URL` for the app role and a separate
   migration URL for the owner role. When hosted, both passwords live in the provider's
   secret store, never in the repository.
4. **Tests as the app role:** the API suites and CI connect as the app role, so a missing
   grant fails a test, and a dedicated test proves the app role cannot update or delete
   evidence, truncate a table, disable a trigger or alter a table.

## Owner steps at hosting

Create the owner and app passwords in the hosting provider's secret store (steps to be
written with the hosting plan). Nothing is needed before then.
