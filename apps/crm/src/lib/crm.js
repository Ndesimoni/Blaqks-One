import { amountOf, clName, get, isDone, isLost, prName } from './records.js';
import { dateNum, readableDate, today } from './dates.js';
import { AED } from './format.js';

function deriveLeadScore(r) {
  const saved = Number(get(r, 'Lead quality score / 100'));
  if (saved > 0) return Math.min(100, saved);
  let score = 15;
  const text = (label) => String(get(r, label) || '').toLowerCase();
  if (['yes'].includes(text('Funds confirmed'))) score += 20;
  if (text('Decision maker') === 'yes') score += 15;
  if (/immediately|30 days/.test(text('Buying / moving urgency'))) score += 20;
  else if (/60 days/.test(text('Buying / moving urgency'))) score += 12;
  else if (/90 days/.test(text('Buying / moving urgency'))) score += 6;
  if (get(r, 'Maximum budget AED')) score += 10;
  if (get(r, 'Preferred communities')) score += 10;
  if (/pre-approved|approved/.test(text('Mortgage stage')) || text('Finance type') === 'cash')
    score += 10;
  return Math.min(score, 100);
}

const leadTier = (r) => {
  if (isLost(get(r, 'Lead stage'))) return 'Lost';
  if (/closed/i.test(String(get(r, 'Lead stage') || ''))) return 'Converted';
  const s = deriveLeadScore(r);
  return s >= 75 ? 'Hot' : s >= 50 ? 'Warm' : 'Nurture';
};

const feeNumber = (d) => {
  const b = Number(get(d, 'Agreed value AED')) || 0;
  const rate = Number(get(d, 'Fee rate %')) || 0;
  const fixed = Number(get(d, 'Fixed fee AED')) || 0;
  return /fixed/i.test(String(get(d, 'Fee basis') || '')) ? fixed : (b * rate) / 100;
};

const yourFee = (d) => {
  const after = feeNumber(d) * (1 - (Number(get(d, 'Partner share %')) || 0) / 100);
  return (after * (Number(get(d, 'Your share %')) || 0)) / 100;
};

const totalPaid = (deal, records) =>
  records.Payments.filter((p) => get(p, 'Deal ID') === get(deal, 'Deal ID')).reduce(
    (sum, p) => sum + (Number(get(p, 'Your fee received AED ex VAT')) || 0),
    0,
  );

const isDue = (r) => {
  const due = String(
    get(r, 'Due date') || get(r, 'Action due') || get(r, 'Next contact') || '',
  ).slice(0, 10);
  return due && due <= today() && !isDone(get(r, 'Task status') || get(r, 'Action status'));
};

function computedVal(data, module, record, key) {
  if (module === 'Clients') {
    if (key === 'lead_tier_auto') return leadTier(record);
    if (key === 'last_contact_auto')
      return (
        data['Follow-ups']
          .filter((x) => get(x, 'Client ID') === get(record, 'Client ID'))
          .map((x) => get(x, 'Contact date'))
          .sort()
          .at(-1) || ''
      );
    if (key === 'next_follow_up_auto')
      return (
        data['Follow-ups']
          .filter(
            (x) =>
              get(x, 'Client ID') === get(record, 'Client ID') && !isDone(get(x, 'Task status')),
          )
          .map((x) => get(x, 'Due date'))
          .filter(Boolean)
          .sort()[0] || ''
      );
    if (key === 'follow_up_status_auto') {
      const next = computedVal(data, 'Clients', record, 'next_follow_up_auto');
      return !next
        ? 'No task'
        : next < today()
          ? 'Overdue'
          : next === today()
            ? 'Due today'
            : 'Scheduled';
    }
    if (key === 'duplicate_contact')
      return data.Clients.filter(
        (c) => c !== record && get(c, 'Phone') && get(c, 'Phone') === get(record, 'Phone'),
      ).length
        ? 'Duplicate'
        : '';
  }
  if (module === 'Deals') {
    if (key === 'gross_fee_aed_ex_vat') return feeNumber(record);
    if (key === 'after_partner_aed')
      return feeNumber(record) * (1 - (Number(get(record, 'Partner share %')) || 0) / 100);
    if (key === 'your_expected_fee_aed') return yourFee(record);
    if (key === 'your_earned_fee_aed') return get(record, 'Earned date') ? yourFee(record) : 0;
    if (key === 'outstanding_aed')
      return Math.max(
        0,
        (get(record, 'Earned date') ? yourFee(record) : 0) - totalPaid(record, data),
      );
    if (key === 'payment_status')
      return !get(record, 'Earned date')
        ? 'Not earned'
        : computedVal(data, 'Deals', record, 'outstanding_aed') === 0
          ? 'Paid'
          : 'Outstanding';
  }
  if (module === 'Payments' && key === 'total_received_aed')
    return amountOf(record, 'Your fee received AED ex VAT') + amountOf(record, 'VAT received AED');
  if (['Follow-ups', 'Viewings', 'Shortlist', 'Interaction log', 'Client care'].includes(module)) {
    if (key === 'client_name_auto') return clName(data, get(record, 'Client ID'));
    if (key === 'property_title_auto') return prName(data, get(record, 'Property ID'));
    if (key === 'due_date_alert') return isDue(record) ? 'Overdue' : 'On track';
    if (key === 'reminder_auto') return isDue(record) ? 'Due now' : 'Scheduled';
  }
  if (module === 'Properties') {
    if (key === 'availability_review')
      return !get(record, 'Last verified')
        ? 'Verify'
        : dateNum(today()) - dateNum(get(record, 'Last verified')) > 14 * 86400000
          ? 'Review'
          : 'Current';
    if (key === 'permit_date_alert') {
      const exp = get(record, 'Permit expiry');
      return !exp ? '—' : exp < today() ? 'Expired' : 'Valid';
    }
  }
  return get(record, key);
}

function valueOf(data, module, r, f) {
  return f.calculated ? computedVal(data, module, r, f.key) : r[f.key];
}

function formatValue(data, module, r, f) {
  let v = valueOf(data, module, r, f);
  if (v === undefined || v === null || v === '') return '—';
  if (f.type === 'number' && /AED|fee|amount|budget/i.test(f.name)) return AED(v);
  if (f.type === 'date' || f.type === 'datetime-local') return readableDate(v);
  return String(v);
}

export {
  deriveLeadScore,
  leadTier,
  feeNumber,
  yourFee,
  totalPaid,
  isDue,
  computedVal,
  valueOf,
  formatValue,
};
