# Admin-owned teams

Connected CRM teams are stored in Docker PostgreSQL and enforced by the Rust API. They are separate from the older browser-only team preview.

## Ownership and authority

- The single **Super Admin** oversees all Admins and teams. The owner may invite Admins from the organisation workspace and manage staff in the selected team.
- An **Admin** owns a workspace and may invite, configure, suspend and restore only that workspace's staff. An Admin cannot create another Admin, change ownership or promote anyone to Super Admin.
- The verified sign-up flow is the only other Admin-creation path. It creates one Admin and one new company together; it cannot create staff, a Super Admin or membership in an existing company. It remains local-development only until the hosted-delivery safeguards are complete.
- A **staff member** joins the owning Admin's existing workspace. Their records remain in that workspace, rather than a new personal workspace. Staff cannot manage the team, invite members or switch to another Admin's workspace.
- Existing account IDs, workspace IDs, CRM records and SQL migrations are preserved. Migration 4 adds team membership, permission grants, invitation state and redacted team activity. No example staff accounts are inserted into your real database.

Backend sessions resolve active membership and current grants on each request. Suspending a staff member revokes their sessions. An inactive owner also blocks subordinate sessions, login and invitation activation. Permission changes invalidate staff sessions; members sign in again to use their updated access.

## Positions

One person may hold several positions. Selecting positions combines their default module grants; the Admin can review and adjust those grants before saving.

| Position                     | Intended responsibilities                                          |
| ---------------------------- | ------------------------------------------------------------------ |
| Receptionist                 | Enquiries, contacts, calls and viewing coordination                |
| Lead Manager                 | Lead qualification, follow-ups and conversion tracking             |
| Property Agent / Consultant  | Clients, listings, viewings and deals                              |
| Listing Coordinator          | Property information, photos, availability and landlord details    |
| Accountant / Finance Officer | Expenses, payments, commissions and financial reports              |
| Property Manager             | Rentals, landlords, tenants, renewals and maintenance coordination |
| Marketing Coordinator        | Campaigns, lead sources and permitted communication channels       |
| Team Supervisor              | Work allocation, team visibility and performance monitoring        |

Positions are job labels, not privileged account roles. A Team Supervisor is still staff and cannot invite or manage other accounts.

## Permission boundary

The foundation uses six module grants: relationships, properties, schedule, finance, reports and exports. Email and WhatsApp permissions are separate booleans. Position changes do not silently grant messaging access.

Connected data workflows cover **Clients (and the Leads view), Contacts, Properties, Follow-ups, Viewings, Shortlist, Interaction log and Client care**. Relationships permits Clients/Contacts CRUD; properties permits Properties and Shortlist CRUD; schedule permits Follow-ups, Viewings, Interaction log and Client care CRUD in the assigned workspace. Scheduling staff without relationships access cannot list Clients, so they see linked client IDs as unavailable in link pickers. Denied collections are excluded before querying the records bundle, and direct mutations are rejected. Staff cannot read the workspace activity API or run backup imports. Within a permitted module, staff see only the records assigned to them (and the activity of clients and properties they hold) unless the Admin turns on **Record visibility → Whole team** for that member. Within each enabled module the Admin ticks what a staff member may do: **Add, Edit, Hand on, Delete activity** and the sensitive **Delete clients & contacts / Delete properties**, which needs whole-team visibility and access to the modules that can link to those records. Positions only suggest ticks for newly enabled modules; **Use position defaults** resets them. Every existing staff member kept their previous abilities when this arrived (migration 9); Admins and the Super Admin always have every action. A staff member given a client's Follow-up directly may complete or return it but not delete it. See [Assignments design](assignments-design.md) and [Action permissions design](action-permissions-design.md).

Schedule, finance, reports and exports can be configured as future access settings; their connected modules are not implemented yet. Messaging permissions record permission only: they do not connect mailboxes, send email or WhatsApp, or enable social platforms. Super Admin publication approval remains the platform requirement; no public publishing endpoint is introduced here.

## Invite and activate

1. Sign in to connected mode and open **Team**.
2. Check the active workspace. The Super Admin may choose another Admin's workspace; an Admin sees their own team.
3. Choose **Invite teammate**, enter the person's name, email and international phone, select positions and review access. The Super Admin can invite an Admin from the organisation workspace.
4. Copy the one-use invitation link and share it yourself. The CRM does not send an invitation email or WhatsApp message.
5. The invited person opens that link, reviews the team details and creates a password of at least eight characters. They then sign in with their email and chosen password.
6. Choose **Cancel invitation** on the person's card and confirm to disable a pending invitation immediately. You do not need to wait for its 48-hour expiry. The card shows **Invitation cancelled**, and the old link can no longer activate the account.
7. Activated accounts show **Suspend account** directly on their card; suspended accounts show **Restore account**. Confirm the action to change access while retaining records. Suspending an Admin also blocks their staff and ends their sessions. Only the Super Admin can suspend or restore Admins, from the organisation workspace; Admins manage their own staff.
8. Use the person's **Edit** button to change contact details, then **Continue** to **Roles & access** for grants and the **Account active** checkbox. Continue to **Review** and choose **Save changes**. Pending accounts show **Keep invitation active** instead and cannot be made active through member editing.
9. Choose **Renew invitation** for a pending or cancelled account if its link was lost or expired. Renewal replaces the old token and preserves the same member and workspace; activated accounts cannot be renewed.

Account email changes and password recovery are deferred. The Admin never sees the staff password. Invitation links contain secrets; only their SHA-256 hashes are stored in PostgreSQL, they expire after 48 hours, and activation consumes them atomically. Expired, revoked, consumed and invalid links cannot activate an account.

Public invitation endpoints require the configured browser Origin, bounded authentication work and a database-backed request budget. Team mutations additionally require the signed-in session's CSRF token. Member edits use optimistic versions so concurrent changes cannot silently overwrite each other.

## Delete and archive accounts

Normal account deletion is **soft deletion**, labelled **Delete and archive** in its confirmation screen. Only the Super Admin can use it. It does not erase account identities, password hashes, team configuration, workspaces, records, media or business activity. The archive keeps those records in their original workspace; it never transfers them to another Admin.

- In the organisation workspace, open **Team**, find an Admin and choose **Delete account**. Review the saved-record and team-account counts, then type the account's email exactly and choose **Delete and archive**. The Super Admin can also archive an individual staff account in its selected team.
- Deleting an Admin archives that Admin and every staff account below them. All their sessions and invitation links are revoked immediately. Their entire workspace becomes read-only, including direct API requests and imports.
- Deleting an individual staff account blocks only that person. The Admin's shared workspace and other teammates remain available. Staff do not own separate copies of company records.
- Deleted accounts leave **Current accounts**. Open **Archived accounts** in Team to inspect saved account details. Archived Admin cards link to their saved workspace, which also appears in the separate **Archived workspaces · Read-only** selector group. The Super Admin can inspect records and archived team membership without editing either.
- **Suspend account** remains the temporary, reversible option. Archived accounts have no restore, edit, renewal or invitation action. Their original email remains reserved. The database also prevents updates to archived identities and prevents archiving the Super Admin.
- **Hard deletion is not implemented.** It must be a separate future process with a full dependency review, backup/export and explicit permanent-loss confirmation. Normal deletion must never silently erase company data.

Migration 5 adds archival metadata and database safeguards without archiving any existing account. The delete endpoint checks a current account version, exact email confirmation and a fingerprint of the reviewed team. If a teammate is added or changed before confirmation, the whole operation stops and requires a fresh review. Archival and redacted audit events commit atomically in the affected workspace; failures leave accounts and records intact.

If a deletion response is interrupted, close the review to refresh Team and the workspace directory. Check **Archived accounts** before attempting another deletion. A lost response does not restore the account or erase its archive.

Additional routes are `GET /workspaces/:workspace/team/:id/archive-preview`, `DELETE /workspaces/:workspace/team/:id`, and Super Admin-only `GET /workspaces/:workspace/team?archived=true`. The DELETE body includes `version`, `confirmationEmail` and `teamFingerprint`; no hard-delete flag is accepted.

## Data and audit

`crm_users` stores the account role, owning account/workspace, positions and permission grants. `crm_team_invitations` stores hashed invitation tokens and lifecycle timestamps. `crm_team_activity` stores append-only actor, affected workspace, member ID, action and time. It excludes names, addresses, passwords, tokens and message contents. Staff-authored CRM changes keep the staff actor ID and Admin workspace ID distinct.

The API applies migrations 4 and 5 on startup. You can also run `npm run db:migrate` to apply pending migrations without starting another API listener. Stop the old Rust process and restart `npm run dev:api` after updating the code. Existing Docker volumes must remain intact. Refresh the frontend after its development server picks up the changes.

Team routes are `GET /workspaces/:workspace/team`, `POST /workspaces/:workspace/team/invitations`, `PATCH /workspaces/:workspace/team/:id` and `POST /workspaces/:workspace/team/:id/invitations` for renewal. Every customer company starts with 3 total seats, including its owner; active staff and live pending invitations consume the rest. Invitation creation, renewal, activation, restoration and sample seeding all enforce the company limit under the workspace lock. The Super Admin can change a customer company's limit as platform metadata through `PUT /workspaces/:workspace/company/seat-limit`, but cannot set it below current usage; every change is versioned and audited. Public activation uses `POST /auth/invitations/inspect` and `POST /auth/invitations/accept`. All paths are under `/api/crm`; invitation secrets are sent in request bodies rather than API query strings. The browser activation link keeps its token in the hash route, which is not sent to the web server.

## Verification

Use the disposable Docker database in `npm run test:api` or `PLAYWRIGHT_CHANNEL=chrome npm run test:server:e2e`; never seed synthetic staff into the development database. Tests cover team isolation, role escalation attempts, owner and member suspension, live permission enforcement, stale edits, eight-character passwords, one-use invitations, expiry/revocation, concurrent activation and redacted audit.

Run CRM Cargo tests, formatting and Clippy, frontend unit tests and builds, default demo browser regression checks, and the repository file-size check. This is a local development foundation; hosted operations, invitations sent by providers, recovery and the remaining CRM modules are separate work.
