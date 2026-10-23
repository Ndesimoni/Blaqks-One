# R2 and A6 design review — 2026-10-23

Status: design review complete; implementation has not started. Required amendments
below override the proposals in [Record sharing, R2](record-sharing.md#r2--sharing-a-listing-or-a-lead-with-another-company)
and [Agreements, A6](agreements-design.md#19-a6-design-outside-agents-by-recipient-locked-link-2026-10-23).
The owner's unanswered choices remain unanswered; recommendations are not approvals.

## Continuity and scope

Claude completed R1 in `4232ba5` and the dropdown interaction fix in `1817ff6`.
The remaining working-tree drafts were R2 and A6. This packet reviews those drafts;
it does not reopen R1 or implement unapproved cross-company or guest flows.
An independent security specialist reviewed R2, an architect reviewed A6, and the
primary agent reconciled their findings against existing authorization and signup code.
These are design gaps, not claims of exploitable R2/A6 code already running.

## R2 required amendments

1. **High: counter-offer finalization.** Existing `agreements/respond.rs` lets the
   participant opposite the revision author accept. A recipient counter-offer therefore
   needs sender acceptance. The draft's recipient-only acceptance cannot be reused.
   Specify a referral finalizer that locks the receiving workspace before the agreement
   and rechecks the receiving member, active company, Clients grant and Create permission.
   It creates exactly one lead assigned to the recipient, retaining the actual accepting
   actor and an explicit cross-company referral provenance; never impersonate the recipient
   to reuse a create handler. Establish one lock order for all finalization paths before
   implementation; never acquire a second workspace lock after taking the agreement lock.
   Test sender acceptance of a recipient counter, permission loss, suspension, duplicate
   accepts and full rollback when lead creation fails.
2. **High: atomic revocation.** A source-record change and the outside-share revocation
   must both commit or both roll back. Do not swallow trigger errors. Triggers perform
   bounded database work only. Inject a revocation failure and prove neither state changes;
   cover assignment, departure, H3, source deletion and sample clearing.
3. **Medium: tracked media staging.** Reserve a tracked unattached copy row, company bytes
   and a unique storage key before copying bytes. Bound pending bytes and concurrent copy
   operations, including copies that bypass upload budgets. Mark successful storage before
   attaching; cleanup must find failed or abandoned copies, including crashes between
   storage success and database completion. Reconcile reservations on retries, duplicate
   snapshot races and quota failures. Legacy inline assets need an explicit supported or
   refused path; the proposal's S3 copy step cannot copy an inline data URL.
4. **Medium: unattended contact expiry.** Ship an idempotent expiry worker with referrals.
   It erases held contacts even when nobody reads or writes the expired offer, using the
   same agreement locks as acceptance. This is distinct from five-year evidence retention
   and photo cleanup. Test expiry without user activity and acceptance racing expiry.
5. **Medium: exported-content policy.** Field allowlists exclude structured owner fields
   but cannot remove owner details or exact location embedded in descriptions, URLs,
   filenames, photos or plans. Preview all exported content; use neutral filenames and
   safe URL rendering, clean supported metadata and require sender review. The owner must
   settle whether the promise covers structured fields only or reviewed/redacted content
   in every asset. Do not describe the present proposal as automatic confidentiality.
6. **Response matrix.** Specify sender, recipient and both Admin views for pending,
   accepted and closed shares, separately for list, detail, evidence and files. Closure
   removes listing facts from the receiving Admin too unless the owner explicitly chooses
   otherwise. R2 needs an access wrapper for its identical-404 promise: existing
   `agreements/access.rs::ensure_reader` returns 403 for Super Admin.

## A6 required amendments

1. **High: revocation and verification races.** Specify workspace → agreement → link →
   session → challenge locking for commands that touch these rows. Recheck live link,
   session expiry, verification, current revision and sender eligibility under those locks.
   Revocation, reissue, verification, reads and actions must have a defined serialization
   point. A command queued after revocation cannot complete with a previously valid session.
   Wrong-code counters must commit even when verification returns an error, as signup's
   `verify_store.rs` already does. Test parallel guesses, resend/reissue and revocation
   against verification and acceptance; budgets must not reset through a failed transaction.
2. **High: claims are a new authorization path.** Changing `party_of` alone is insufficient:
   `access.rs::visible_to`, `store.rs::list` and `waiting.rs` still require member/workspace
   participants. Explicitly extend list, detail, badges, certificate and every command to
   claimant-only access through a guests-owned lookup, with live membership checks. A
   claimant's Admin receives no personal claim access. Preserve the frozen guest participant
   and bind subsequent member actions to the immutable claim evidence. Test another member,
   Admin, company, archived claimant and same-sender-company claim attempts on every route.
3. **High: cleanup ships with the data.** A6a must include expiry cleanup for sessions,
   challenges, plaintext codes and abandoned guest contact data. Do not defer it to A6b.
   Retained names in frozen terms are evidence, distinct from operational contact erasure;
   document that distinction. Evidence deletion needs an explicit legal-hold policy before
   a retention job can remove it. No legal retention period is approved by this review.
4. **Signup atomicity.** Attach claims and append claimed events before
   `signup/verify_store.rs` commits account creation. Define email/workspace/agreement lock
   ordering and bound claim enumeration; do not perform an unbounded historical scan inside
   signup. Define concurrent offer creation and later member-code recovery of missed offers.
5. **Identity matrix.** Member participants require workspace and member IDs and no guest
   ID; guest recipients require only a guest ID; senders remain members. Enforce non-null
   actor kinds, evidence presence and allowed actor roles using explicit null-safe checks.
   Audit every guard and reader affected by nullable recipients, retaining existing member
   evidence schemes. Test malformed identities through direct SQL and member regressions.
6. **Two-tab context.** One guest cookie can switch agreements when another link opens.
   Bind the displayed offer context to submitted actions and reject stale-tab mismatches;
   never resolve an old page's action silently against the new cookie's agreement. Define
   return/reverification behavior and test two different links in one browser.
7. **Dependencies and numbering.** A3b's certificate and lifecycle are prerequisites.
   Allocate migration numbers and decision IDs at implementation; both proposals currently
   reserve D12. Draft migration reservations do not establish execution order.

## Owner decisions and next packet

R2 retains its seven questions (location, end date, sender contact, referral consent,
period, lead creation and media retention), plus the exported-content policy above.
A6 retains its twelve questions. Email-only verification is a material choice because the
earlier Basic rule requires phone verification; do not silently downgrade that rule.

Next: resolve these product choices, specify and review the bounded A3b packet, then
implement prerequisite work before R2 referrals or A6 guest certificates. Listing-only R2
can be scoped separately once its owner choices and required amendments are settled.
Neither external delivery nor publication is authorized by this design review.

Validation: review of current source and uncommitted proposals; Markdown formatting and
diff checks passed. `check:lines:ci` passed; full `check:lines` still reports 37 existing
oversized files, none changed here. No API, browser, database or provider behavior was
exercised by this review.
