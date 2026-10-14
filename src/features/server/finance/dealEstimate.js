/**
 * The deal editor's live estimate (finance-design §7: "Estimate. Final figures are fixed when
 * the deal is earned."). Fee, partner, net and VAT come from the draft through the BigInt
 * engine. The split uses only what this caller's view already holds: the team view reuses the
 * saved deal's server preview share; the own view uses the caller's own agreement and never
 * guesses a hidden team default, override or second-agent share.
 */
import { agreementOn, calculate } from '../../../lib/finance/commission.js';
import { dealFee } from '../../../lib/finance/preview.js';

/** Asia/Dubai calendar date (YYYY-MM-DD), the business day the server uses. */
export function dubaiToday(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Dubai' }).format(now);
}

/** An ISO date moved by whole days (UTC arithmetic, so no daylight-saving drift). */
export function shiftDate(iso, days) {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** Earned-date bounds: never after today; staff approvers no earlier than 31 days ago. */
export function earnDateLimits(access, today = dubaiToday()) {
  return { max: today, min: access?.manage ? '2000-01-01' : shiftDate(today, -31) };
}

const terms = (body, vatRegistered, split = {}) => ({
  fee: dealFee(body),
  partnerShareBp: body.partnerShareBp ?? 0,
  agentShareBp: split.agentShareBp ?? null,
  secondShareBp: split.secondShareBp ?? null,
  secondSource: split.secondSource ?? 'first_agent',
  vatRegistered: vatRegistered === true,
});

/** The share inputs a team view can read from a saved deal, or null for a new deal. */
function teamSplit(deal, settings) {
  if (!deal?.calculation) return null;
  const primary = deal.calculation.lines.find((line) => line.role === 'primary');
  if (deal.calculation.splitSource === 'owner' || !primary) return { owner: true };
  const second = deal.secondAgent;
  const secondSource = second?.kind === 'referral' ? 'first_agent' : settings?.secondAgentSource;
  if (second && !secondSource) return null;
  return {
    agentShareBp: deal.override?.agentShareBp ?? primary.shareBp,
    secondShareBp: second?.shareBp ?? null,
    secondSource: secondSource ?? 'first_agent',
    names: { primary: primary.agent?.name ?? '', second: second?.name ?? '' },
  };
}

/** The own view knows only its own agreement; anything hidden leaves the split unknown. */
function ownSplit(deal, agreements, today) {
  if (deal?.calculation?.adjusted || deal?.secondAgent) return null;
  const agreement = agreementOn(agreements, today);
  return agreement ? { agentShareBp: agreement.agentShareBp } : null;
}

/**
 * `{ grossFils, partnerFils, netFils, vatFils, lines }` or null while the draft is incomplete.
 * `lines` is null when the split cannot be known; otherwise `[{ role, name, amountFils }]`
 * (team: primary, second and company; own: the caller's line only).
 */
export function dealEstimate(body, { team, deal, settings, agreements, today = dubaiToday() }) {
  if (!body) return null;
  const vatRegistered = settings?.vatRegistered;
  let fee;
  try {
    fee = calculate(terms(body, vatRegistered));
  } catch {
    return null;
  }
  const base = {
    grossFils: fee.grossFils,
    partnerFils: fee.partnerFils,
    netFils: fee.netFils,
    vatFils: typeof vatRegistered === 'boolean' ? fee.vatFils : null,
  };
  const split = team ? teamSplit(deal, settings) : ownSplit(deal, agreements, today);
  if (!split) return { ...base, lines: null };
  if (split.owner)
    return { ...base, lines: [{ role: 'company', name: '', amountFils: fee.netFils }] };
  try {
    const result = calculate(terms(body, vatRegistered, split));
    if (!team)
      return { ...base, lines: [{ role: 'primary', name: '', amountFils: result.primaryFils }] };
    const lines = [{ role: 'primary', name: split.names.primary, amountFils: result.primaryFils }];
    if (result.secondFils !== null)
      lines.push({ role: 'second', name: split.names.second, amountFils: result.secondFils });
    lines.push({ role: 'company', name: '', amountFils: result.companyFils });
    return { ...base, lines };
  } catch {
    return { ...base, lines: null };
  }
}
