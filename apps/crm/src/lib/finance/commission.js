/**
 * Editor-preview mirror of the authoritative Rust engine (finance-design §3;
 * services/crm-api/src/finance/{calc,selection,receipts}.rs). Inputs are whole fils and basis
 * points; every product is BigInt, so results equal the server's exactly. Both are tested
 * against tests/fixtures/finance-golden.json. The server's figures always win.
 */
import { MAX_BP, MAX_FILS } from './money.js';

/** UAE VAT, fixed at 5% by decision. */
export const VAT_RATE_BP = 500;
export const secondSources = ['first_agent', 'company'];
export const splitSources = ['override', 'agreement', 'team_default', 'owner'];

const outOfRange = () => new RangeError('Finance amounts are out of range.');

function fils(value) {
  if (!Number.isSafeInteger(value) || value < 0 || value > MAX_FILS) throw outOfRange();
  return BigInt(value);
}

function bp(value) {
  if (!Number.isSafeInteger(value) || value < 0 || value > MAX_BP) throw outOfRange();
  return BigInt(value);
}

/** Back to a JSON-safe number; the Rust `out` refuses negatives the same way. */
function out(value) {
  if (value < 0n || value > BigInt(Number.MAX_SAFE_INTEGER)) throw outOfRange();
  return Number(value);
}

/** Half-up: `(a·b + 5000) div 10000`. */
export const hu = (amount, rateBp) => (amount * rateBp + 5_000n) / 10_000n;
/** Floor: `(a·b) div 10000`. */
export const fl = (amount, rateBp) => (amount * rateBp) / 10_000n;

const absent = (value) => value === null || value === undefined;

/**
 * §3.2 steps 1–5. `terms` = `{ fee: { basis: 'percentage', agreedValueFils, rateBp } |
 * { basis: 'fixed', feeFils }, partnerShareBp, agentShareBp|null, secondShareBp|null,
 * secondSource, vatRegistered }`. A null agent share (owner-held or queued) means no agent
 * lines. Fee and partner round half-up, agent lines floor, the company absorbs remainders.
 */
export function calculate(terms) {
  const { fee } = terms;
  let gross;
  if (fee?.basis === 'fixed') gross = fils(fee.feeFils);
  else if (fee?.basis === 'percentage') gross = hu(fils(fee.agreedValueFils), bp(fee.rateBp));
  else throw outOfRange();
  const partner = hu(gross, bp(terms.partnerShareBp));
  const net = gross - partner;
  let [primary, second, company] = [null, null, net];
  if (!absent(terms.agentShareBp)) {
    const share = bp(terms.agentShareBp);
    const cut = absent(terms.secondShareBp) ? null : bp(terms.secondShareBp);
    if (!secondSources.includes(terms.secondSource)) throw outOfRange();
    if (cut === null) {
      primary = fl(net, share);
      company = net - primary;
    } else if (terms.secondSource === 'first_agent') {
      const pool = fl(net, share);
      second = fl(pool, cut);
      [primary, company] = [pool - second, net - pool];
    } else {
      primary = fl(net, share);
      second = fl(net - primary, cut);
      company = net - primary - second;
    }
  }
  const vat = terms.vatRegistered === true ? hu(net, BigInt(VAT_RATE_BP)) : 0n;
  return {
    grossFils: out(gross),
    partnerFils: out(partner),
    netFils: out(net),
    primaryFils: primary === null ? null : out(primary),
    secondFils: second === null ? null : out(second),
    companyFils: out(company),
    vatFils: out(vat),
  };
}

/**
 * §3.2 step 3: override, then the agreement in force, then the team default; an owner-held or
 * queued deal has no agent share (`owner`).
 */
export function selectShare(ownerHeld, overrideBp, agreementBp, teamDefaultBp) {
  if (ownerHeld) return { agentShareBp: null, splitSource: 'owner' };
  if (!absent(overrideBp)) return { agentShareBp: overrideBp, splitSource: 'override' };
  if (!absent(agreementBp)) return { agentShareBp: agreementBp, splitSource: 'agreement' };
  return { agentShareBp: teamDefaultBp, splitSource: 'team_default' };
}

/** An agreement is in force on `on` (ISO dates) when `from ≤ on < to`, or `to` is open. */
export function inForce(from, to, on) {
  return from <= on && (absent(to) || on < to);
}

/** The first agreement in force on `on`, or null (the team default then applies). */
export function agreementOn(agreements, on) {
  const found = (agreements || []).find((agreement) =>
    inForce(agreement.effectiveFrom, agreement.effectiveTo, on),
  );
  return found ?? null;
}

/** §3.2 step 6: half-up VAT on one payment (ex VAT), or 0 when not VAT registered. */
export function paymentVat(amountFils, vatRegistered) {
  const amount = fils(amountFils);
  return out(vatRegistered === true ? hu(amount, BigInt(VAT_RATE_BP)) : 0n);
}

const integer = (value) => {
  if (!Number.isSafeInteger(value)) throw outOfRange();
  return BigInt(value);
};
const positive = (value) => (value > 0n ? value : 0n);

/** §3.2 step 7: a line's share of approved receipts, `line·min(r, net) div net` (0 if net = 0). */
export function receivedShare(lineFils, receivedFils, netFils) {
  const [line, net] = [positive(integer(lineFils)), positive(integer(netFils))];
  if (net === 0n) return 0;
  const received = integer(receivedFils);
  const counted = received < 0n ? 0n : received > net ? net : received;
  return out((line * counted) / net);
}

/** Deal outstanding: `max(0, net − received)`. */
export function outstanding(netFils, receivedFils) {
  const remaining = integer(netFils) - integer(receivedFils);
  return remaining > 0n ? out(remaining) : 0;
}
