/**
 * The Admin split panel (finance-design §6.2, §13 M-F4; §15.2): second agent, their share and
 * an override of the holder's share. Shares are parsed to basis points through `money.js`.
 * The "after" figures reuse the BigInt engine with the shares the team view already holds.
 */
import { calculate } from '../../../lib/finance/commission.js';
import { bpToPercent, parsePercent } from '../../../lib/finance/money.js';
import { dealFee } from '../../../lib/finance/preview.js';

export const pairMessage = 'Choose a second agent and their share together.';

const percent = (bp) => (bp === null || bp === undefined ? '' : bpToPercent(bp));

export function splitDraftFromDeal(deal) {
  return {
    secondAgentId: deal.secondAgent?.id ?? '',
    secondShare: percent(deal.secondAgent?.shareBp),
    override: percent(deal.override?.agentShareBp),
    reason: '',
  };
}

/** `{ value, errors }`: `value` is the exact split body (without version and reason). */
export function readSplitDraft(draft) {
  const errors = {};
  const second = parsePercent(draft.secondShare);
  const override = parsePercent(draft.override);
  if (second.error) errors.secondShare = second.error;
  if (override.error) errors.override = override.error;
  if (Boolean(draft.secondAgentId) !== (second.value !== null && !second.error))
    errors.secondShare = errors.secondShare || pairMessage;
  if (Object.keys(errors).length) return { value: null, errors };
  return {
    errors,
    value: {
      secondAgentId: draft.secondAgentId || null,
      secondAgentShareBp: draft.secondAgentId ? second.value : null,
      overrideAgentShareBp: override.value,
    },
  };
}

/** True when the split differs from the saved one (the server then needs a reason). */
export function splitChanged(deal, value) {
  if (!value) return false;
  return (
    (deal.secondAgent?.id ?? null) !== value.secondAgentId ||
    (deal.secondAgent?.shareBp ?? null) !== value.secondAgentShareBp ||
    (deal.override?.agentShareBp ?? null) !== value.overrideAgentShareBp
  );
}

/**
 * Estimated `{ primaryFils, secondFils, companyFils }` after the change, or null when the
 * holder's share cannot be known (a queued deal, or an override being cleared).
 */
export function splitAfter(deal, settings, value, kind = null) {
  const calc = deal.calculation;
  const primary = calc?.lines.find((line) => line.role === 'primary');
  if (!value || !calc || !primary) return null;
  const clearing = deal.override && value.overrideAgentShareBp === null;
  const agentShareBp = value.overrideAgentShareBp ?? (clearing ? null : primary.shareBp);
  if (agentShareBp === null || agentShareBp === undefined) return null;
  const secondSource = kind === 'referral' ? 'first_agent' : settings?.secondAgentSource;
  if (value.secondAgentId && !secondSource) return null;
  try {
    const result = calculate({
      fee: dealFee(deal),
      partnerShareBp: deal.partnerShareBp,
      agentShareBp,
      secondShareBp: value.secondAgentShareBp,
      secondSource: secondSource ?? 'first_agent',
      vatRegistered: false,
    });
    return {
      primaryFils: result.primaryFils,
      secondFils: result.secondFils,
      companyFils: result.companyFils,
    };
  } catch {
    return null;
  }
}
