/** Shared steps for the in-company hand-over agreement suites (agreements design §14). */
import { query } from './helpers.mjs';
import { financePath } from './finance-helpers.mjs';
import { post } from './finance-deals-helpers.mjs';

export const RELOAD = 'Reload the hand-over offer and decide again.';
export const HANDOVER = 'Use Deals to act on this hand-over.';
export const EXPIRED = 'This hand-over offer has expired. Cancel it and offer the deal again.';
export const KIND_FIXED = 'Changing between a full hand-over and a referral needs a new offer.';
export const FROZEN =
  'This deal has a pending hand-over. Cancel it before changing the fee, client, property or split.';

export const agreementPath = (admin, id = '') =>
  `/workspaces/${admin.user.workspaceId}/agreements${id ? `/${id}` : ''}`;

/** The holder offers `deal` to `to`; returns the pending hand-over. */
export async function offer(admin, holder, deal, to, referralShareBp = null) {
  const made = await post(holder, admin, deal.id, 'handovers', {
    version: deal.version,
    toId: to.user.id,
    referralShareBp,
  });
  if (made.status !== 201) throw Error(`offer: ${JSON.stringify(made.value)}`);
  return made.value.handover;
}

export const decide = (session, admin, handover, action, body) =>
  session.request(financePath(admin, `/handovers/${handover.id}/${action}`), {
    method: 'POST',
    body,
  });

/** The agreement as `session` reads it, or the refusal. */
export const read = (session, admin, handover) =>
  session.request(agreementPath(admin, handover.agreementId));

/** Stored state and the latest event's action and party, straight from the database. */
export function stored(handover) {
  return query(`SELECT a.state||'|'||e.action||'|'||coalesce(e.party,'-')
    FROM agreements.crm_agreements a JOIN agreements.crm_agreement_events e
    ON e.agreement_id=a.id WHERE a.id='${handover.agreementId}'
    ORDER BY e.created_at DESC, e.action LIMIT 1`);
}

/** No sent agreement may outlive its hand-over (design §14 invariant). */
export const orphans = () =>
  query(`SELECT count(*) FROM crm_deal_handovers h JOIN agreements.crm_agreements a
    ON a.id=h.agreement_id WHERE a.state='sent' AND h.status<>'pending'`);
