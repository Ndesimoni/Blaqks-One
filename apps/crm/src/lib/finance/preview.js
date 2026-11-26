/**
 * The deal editor's live estimate (finance-design §7: "Estimate. Final figures are fixed when
 * the deal is earned."). Fee, partner and net need only the draft; the split needs the share
 * the server would select. When the caller cannot see an input (the own view never receives
 * the team default or a second agent's share) the split stays unknown instead of guessed.
 */
import { agreementOn, calculate, selectShare } from './commission.js';

const absent = (value) => value === null || value === undefined;

/** Fee terms from a deal draft (`feeBasis`, `agreedValueFils`, `feeRateBp`, `fixedFeeFils`). */
export function dealFee(deal) {
  return deal?.feeBasis === 'fixed'
    ? { basis: 'fixed', feeFils: deal.fixedFeeFils }
    : { basis: 'percentage', agreedValueFils: deal?.agreedValueFils, rateBp: deal?.feeRateBp };
}

/**
 * Which share applies, or null when it cannot be known from what this caller sees.
 * `context` = `{ ownerHeld, overrideBp, agreements, on, teamDefaultBp }`.
 */
export function previewShare(context = {}) {
  const agreement = context.on ? agreementOn(context.agreements, context.on) : null;
  const selected = selectShare(
    context.ownerHeld === true,
    context.overrideBp,
    agreement?.agentShareBp,
    context.teamDefaultBp,
  );
  if (selected.splitSource !== 'owner' && absent(selected.agentShareBp)) return null;
  return { ...selected, agreementId: agreement?.id ?? null };
}

/**
 * `{ grossFils, partnerFils, netFils, vatFils|null, split|null }`, or null when the draft's
 * figures are incomplete or out of range. `split` = `{ splitSource, agentShareBp,
 * agreementId, primaryFils, secondFils, companyFils }`. `context` adds `vatRegistered`
 * (null when settings are unknown), `hasSecond`, `secondShareBp` and `secondSource`.
 */
export function previewDeal(deal, context = {}) {
  const base = {
    fee: dealFee(deal),
    partnerShareBp: deal?.partnerShareBp ?? 0,
    secondSource: 'first_agent',
    vatRegistered: context.vatRegistered === true,
  };
  let fee;
  try {
    fee = calculate({ ...base, agentShareBp: null, secondShareBp: null });
  } catch {
    return null;
  }
  const vatFils = typeof context.vatRegistered === 'boolean' ? fee.vatFils : null;
  const estimate = {
    grossFils: fee.grossFils,
    partnerFils: fee.partnerFils,
    netFils: fee.netFils,
    vatFils,
  };
  const share = previewShare(context);
  const second = context.hasSecond === true;
  const secondKnown = !second || (!absent(context.secondShareBp) && context.secondSource);
  if (!share || (share.splitSource !== 'owner' && !secondKnown))
    return { ...estimate, split: null };
  try {
    const split = calculate({
      ...base,
      agentShareBp: share.agentShareBp,
      secondShareBp: second ? context.secondShareBp : null,
      secondSource: second ? context.secondSource : 'first_agent',
    });
    const { primaryFils, secondFils, companyFils } = split;
    return { ...estimate, split: { ...share, primaryFils, secondFils, companyFils } };
  } catch {
    return { ...estimate, split: null };
  }
}
