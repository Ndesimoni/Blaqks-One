# My profile: account self-service (connected)

Status: security design approved by the owner on 2026-10-15. Owner decisions are in [Product decisions](product-decisions.md#my-profile-decided-2026-10-15).

## Scope

Every signed-in member (Super Admin, Admins and staff alike, with no extra powers) can view their account, edit their own name and phone, change their password, and review or revoke their own sign-in sessions. Email, role, positions, permissions, channel access, record scope, actions, active state, owner and workspace are **never self-editable**. Email change, password recovery and MFA are deferred (see the end).

## Facts this design relies on

- `GET /auth/session` already returns the full profile.
- `crm_sessions` stores only `token_hash, user_id, csrf_token, expires_at, created_at`.
- The frontend clears the identity on any 401, so **a wrong current password must never return 401**.
- Name and phone validation lives in `team/validation.rs`; `auth` must not import `team` (boundary rule 5).

## Module ownership

- Self-service lives in a new `auth/account/` module (`profile.rs`, `password.rs`, `sessions.rs`, `events.rs`).
- Name and phone validation moves to `auth/identity_rules.rs`, and `team` reuses it.
- `auth/` owns the identity columns, `crm_sessions`, `crm_login_limits` and the new `crm_account_events`.

## Password policy

These rules apply to every **new** password: password change, invitation activation and the account CLI.

- At least **8 characters**.
- At least one **uppercase** letter, one **lowercase** letter, one **number** and one **special character** (any character that is not a letter or a number).
- At most 1024 bytes.
- Different from the current password and from the account email.
- Existing passwords keep working until changed.

The error is 400 `weak_password`, "Use at least 8 characters with an uppercase letter, a lowercase letter, a number and a special character."

## Endpoints

All endpoints are under `/api/crm/auth`, with a 16 KiB body limit, `deny_unknown_fields` and the usual error shape.

### 1. `GET /account`

- **Returns** `{user: Profile, version, passwordChangedAt, team: {workspaceId, ownerName}}`. `ownerName` comes from the `crm_user_profiles` view.
- **Errors:** 401.

### 2. `PATCH /account {version, name?, phone?}`

- **Check order:** session (401), then Origin and CSRF (403), then body (400), then trim and validate (name 1–100 characters, E.164 phone; 400).
- **In one transaction:**
  1. `workspaces::lock`.
  2. Select self `FOR UPDATE` where `active AND owner_active AND deleted_at IS NULL`; return 401 when the account is not live.
  3. Return 409 `stale` on a version mismatch.
  4. Update name and phone, set `version + 1` and write a `profile_updated` event.
- **Sessions:** none are revoked, because access does not change.
- **Returns** the same shape as `GET /account`.
- Any other field returns 400.

### 3. `POST /account/password {currentPassword, newPassword}`

- **Check order:**
  1. Session (401).
  2. CSRF (403).
  3. Body (400).
  4. Policy (400 `weak_password`).
  5. Throttle: key `password:{user_id}`, 5 attempts per 15 minutes, separate from the sign-in budget. 429 `rate_limited`, "Too many password attempts. Try again later."
- **Checking the current password:** take a `password_workers` permit and always run Argon2 verify against the stored hash. A wrong password returns **400** `invalid_current_password`, "Current password is incorrect." It never returns 401 and never changes the session.
- **New hash:** hash the new password with the existing Argon2id parameters.
- **In one transaction:**
  1. Workspace lock.
  2. Re-select self `FOR UPDATE` with the live checks; return 409 if `password_hash` changed since the verify.
  3. Update `password_hash` and `password_changed_at`. Do **not** bump `version`, so an Admin's open edit stays valid.
  4. Delete **all** of the user's sessions, including the current one.
  5. Insert a fresh session with a new token **and** a new CSRF token.
  6. Write a `password_changed` event, then commit.
- **Response:** `Set-Cookie` with the new token, and body `{csrfToken, signedOutOthers: n}`.

### 4. `GET /sessions`

- **Returns** the caller's own unexpired sessions: `[{id, createdAt, lastSeenAt, expiresAt, device, current}]`.
- Never includes `token_hash` or `csrf_token`.

### 5. `DELETE /sessions/{id}`

- Requires CSRF. Deletes only where `id = $1 AND user_id = self`.
- A malformed, unknown or other user's id returns the identical 404 `not_found`.
- The current session returns 400, "Use Sign out on this device."
- Writes a `session_revoked` event.

### 6. `POST /sessions/revoke-others`

- Requires CSRF. Deletes all of the caller's sessions except the current one.
- **Returns** `{revoked: n}` and writes a `sessions_revoked` event.

Suspended or archived accounts, and staff of a suspended Admin, already fail the session extractor (401). The archive trigger also blocks updates to an archived account.

### 7. `PUT /account/language {language}`

Added 2026-10-16 with migration 0021: the caller's own interface language, `en` or `ar` only. See [Language foundation](i18n.md#choosing-a-language).

## Database: migration 0018 (owner: auth)

`crm_sessions` gains three columns:

- `id UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE`.
- `last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now()`, refreshed by the session extractor only when it is older than 5 minutes.
- `device TEXT NULL CHECK (char_length(device) <= 60)`: a coarse "Browser · OS" label from an allowlist parse of the User-Agent at sign-in. Never the raw User-Agent, never an IP.

`crm_users` gains `password_changed_at TIMESTAMPTZ NULL`.

The new table `crm_account_events` has:

- columns `(id, user_id, actor_id, workspace_id, action, created_at)`;
- `action IN ('profile_updated', 'password_changed', 'sessions_revoked', 'session_revoked')`;
- an immutable trigger;
- no field values, passwords, tokens, IPs or User-Agents.

`actor_id` is kept separate from `user_id` so that a future Admin-issued reset fits the same table.

## Frontend

- **Location:** a connected page under `src/features/server/profile/`. The frozen demo profile page stays untouched.
- **Sections:**
  - Account details: email (read-only, "Contact your Admin to change"), role, positions, team and a permission summary.
  - Edit details: name and phone.
  - Change password.
  - Active sessions.
- **Password form:**
  - a hidden `autocomplete="username"` field holding the email;
  - `autocomplete="current-password"` on the current field, and `autocomplete="new-password"` on the new and confirm fields;
  - client-side policy and match checks, with the rule list shown as the user types;
  - values kept only in local component state, cleared after every response and on unmount, and never put in context, storage, the URL or logs.
- **Errors:** 400 shows under the current-password field, 429 as a page alert, 409 as "Reload".
- **Success:** shows "Password changed. Other devices were signed out." The page swaps in the new CSRF token through a client setter.
- **Sessions list:** a "This device" badge, a per-row Sign out with confirmation, and "Sign out all other devices".
- **Accessibility:** aria-live status messages; mobile first.

## Threats handled

| Threat                                    | Handling                                                                                          |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Session fixation or a copied cookie       | Password change rotates the session and CSRF tokens.                                              |
| CSRF                                      | Exact Origin check, session CSRF token and SameSite=Strict on every mutation.                     |
| Brute force from a stolen session         | Per-user limit of 5 attempts per 15 minutes and bounded Argon2 workers.                           |
| Account takeover through a stolen session | Email and password cannot change without the current password; the victim can revoke the session. |
| Enumeration                               | Random session UUIDs and a uniform 404.                                                           |
| Secrets in logs                           | Fixed error strings, request bodies never logged, events without values.                          |
| Timing                                    | Argon2 always runs against the caller's own hash.                                                 |
| Denial of service                         | Body and length caps.                                                                             |

## Acceptance tests

- PATCH changes only name and phone; unknown fields return 400; a stale version returns 409; sessions survive; the event is written.
- The Super Admin can edit their own details; an archived or suspended caller gets 401.
- Policy failures (no uppercase, lowercase, number or special character, or fewer than 8 characters) return 400 `weak_password`. The policy also applies at invitation activation.
- A wrong current password returns 400, not 401, and the session stays valid. The sixth attempt within 15 minutes returns 429.
- After a successful password change:
  - the old cookie and all other sessions get 401;
  - the new cookie works;
  - the old CSRF token gets 403 and the new one works;
  - signing in with the new password works;
  - `version` is unchanged.
- A suspension or archive that runs during a password change leaves no live session.
- The session list shows only the caller's own sessions, without hashes. Revoking another user's session id returns 404; revoking the current one returns 400; revoke-others leaves only the current session.
- Every mutation fails without Origin or CSRF. No password, token or field value appears in `crm_account_events` or `crm_team_activity`.

## Deferred

- **Email change:** verify both the old and the new address once an email provider exists.
- **Recovery:** an Admin- or Super Admin-issued one-use reset link reusing the invitation mechanics (hashed, 48 hours, revokes sessions). For the Super Admin, use the CLI.
- **MFA:** TOTP for the Super Admin and Admins before hosted launch.
- **Before hosting:** a breached or common password blocklist, an idle session timeout and new-device notifications.
