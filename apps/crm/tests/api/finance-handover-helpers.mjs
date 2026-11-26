/** Shared set-up for the H2 hand-over suites: the review preview, approvals chosen by the
 * sender, hand-overs to the Admin and the waiting counts (agreements design §17). */
import assert from 'node:assert/strict';
import { query } from './helpers.mjs';
import { activate, findMember, invite } from './team-helpers.mjs';
import { FINANCE, grant } from './permission-helpers.mjs';
import { financePath, refused } from './finance-helpers.mjs';
import { DEAL_MESSAGES as M, dealTeams, post, seen } from './finance-deals-helpers.mjs';

/** The one not-found every hidden, unknown or decided request gets (amendment 9). */
export const notFound = (result, label = '') =>
  refused(result, 404, M.missing.message, M.missing.code, label);

/** Active staff with Finance `flags` (whole-team records when `teamView`). */
export async function financeStaff(admin, name, flags, positions = ['property-agent']) {
  const staff = await activate(await invite(admin, name, { positions }));
  if (!flags) return staff;
  const member = await findMember(admin, staff.user.id);
  const scope = flags.teamView ? { recordScope: 'team' } : {};
  return grant(admin, staff, { ...scope, actions: { ...member.actions, finance: flags } });
}

/** Takes the Approve right away from `staff` (keeping team view); returns a fresh session. */
export async function withoutApprove(admin, staff) {
  const member = await findMember(admin, staff.user.id);
  const finance = { ...FINANCE.all, approve: false };
  return grant(admin, staff, { actions: { ...member.actions, finance } });
}

/** `dealTeams` plus an own-view agent (`third`) and a property agent with Approve
 * (`backup`), who can hold deals as well as approve them. `owner` is the Super Admin. */
export async function reviewTeams(prefix) {
  const teams = await dealTeams(prefix, { maxReferralShareBp: 2500 });
  return {
    ...teams,
    third: await financeStaff(teams.admin, `${prefix}-third`),
    backup: await financeStaff(teams.admin, `${prefix}-backup`, FINANCE.all),
  };
}

/** `POST /finance/deals/{id}/handovers`; `extra` may add `approverId`. */
export const offerTo = (admin, holder, deal, toId, referralShareBp = null, extra = {}) =>
  post(holder, admin, deal.id, 'handovers', {
    version: deal.version,
    toId,
    referralShareBp,
    ...extra,
  });

/** A created offer; `approver` (a session) asks for approval. */
export async function offered(admin, holder, deal, to, { share = null, approver } = {}) {
  const extra = approver ? { approverId: approver.user.id } : {};
  const made = await offerTo(admin, holder, deal, to.user.id, share, extra);
  assert.equal(made.status, 201, JSON.stringify(made.value));
  return made.value.handover;
}

export const decide = (session, admin, handover, action, body) =>
  session.request(financePath(admin, `/handovers/${handover.id}/${action}`), {
    method: 'POST',
    body,
  });

/** The receiver accepts the agreement version they read. */
export const accept = async (session, admin, handover) =>
  decide(session, admin, handover, 'accept', await seen(session, admin, handover));

/** `GET /finance/handovers/{id}/preview`, in `workspace` (the company's by default). */
export const preview = (session, admin, id, workspace = admin.user.workspaceId) =>
  session.request(financePath(admin, `/handovers/${id}/preview`, workspace));

/** The agreement version the preview shows `session` (approvers cannot read agreements). */
export async function shownVersion(session, admin, handover) {
  const shown = await preview(session, admin, handover.id);
  assert.equal(shown.status, 200, JSON.stringify(shown.value));
  return { agreementVersion: shown.value.offer.agreementVersion };
}

export const waiting = (session, admin) =>
  session.request(financePath(admin, '/handovers/waiting'));

export const agreementsWaiting = (session, workspace = session.user.workspaceId) =>
  session.request(`/workspaces/${workspace}/agreements/waiting`);

/** The caller's hand-over counts, which must be exactly `{answer, approve}`. */
export async function counts(session, admin) {
  const result = await waiting(session, admin);
  assert.equal(result.status, 200, JSON.stringify(result.value));
  assert.deepEqual(Object.keys(result.value).sort(), ['answer', 'approve']);
  return result.value;
}

/** Who holds the deal now, from the database. */
export const holderOf = (deal) => query(`SELECT assignee_id FROM crm_deals WHERE id='${deal.id}'`);

/** Every hand-over request ever made for the deal. */
export const requestsFor = (deal) =>
  query(`SELECT count(*) FROM crm_deal_handovers WHERE deal_id='${deal.id}'`);

export const status = (handover) =>
  query(`SELECT status FROM crm_deal_handovers WHERE id='${handover.id}'`);

/** Agreement state, then each action as action:verification:party, oldest first. */
export const evidence = (handover) =>
  query(`SELECT a.state||'|'||coalesce((SELECT string_agg(x.action||':'||x.verification||':'||
    x.party, ',' ORDER BY x.created_at) FROM agreements.crm_agreement_actions x
    WHERE x.agreement_id=a.id),'') FROM agreements.crm_agreements a
    WHERE a.id='${handover.agreementId}'`);

/** Ends the offer one minute ago, as the A3a suites do. */
export const expire = (handover) =>
  query(`UPDATE agreements.crm_agreements SET expires_at=now()-interval '1 minute',
    version=version+1 WHERE id='${handover.agreementId}'`);

/** Amendment 3: no live agreement outlives a request that closed without moving the deal,
 * and no sent agreement links to a request that is no longer open. */
export const stranded = () =>
  query(`SELECT count(*) FROM crm_deal_handovers h JOIN agreements.crm_agreements a
    ON a.id=h.agreement_id WHERE (a.state IN ('sent','accepted')
    AND h.status IN ('declined','cancelled')) OR (a.state='sent'
    AND h.status NOT IN ('pending','awaiting_approval'))`);
