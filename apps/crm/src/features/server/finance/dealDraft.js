/**
 * Deal editor drafts (finance-design §7, §15.2). The form keeps typed text; money and shares
 * become integer fils and basis points only through `lib/finance/money.js`, never a float.
 * Workbook `details` the form does not show are carried over unchanged.
 */
import { filsToAed, bpToPercent, parseAed, parsePercent } from '../../../lib/finance/money.js';
import { dealStages, dealTypes } from './dealModel.js';

/** The deal endpoints cap agreed values and fees at AED 10bn (§15.2). */
export const DEAL_MAX_FILS = 1_000_000_000_000;
export const dealCapMessage = 'Amounts must be whole fils between 0 and AED 10,000,000,000.';
export const requiredMessages = Object.freeze({
  clientId: 'Choose a client for this deal.',
  agreedValue: 'Enter the agreed value.',
  feeRate: 'Enter the fee rate or fixed fee for the chosen fee basis.',
  fixedFee: 'Enter the fee rate or fixed fee for the chosen fee basis.',
});

export const dealSteps = Object.freeze([
  { id: 'parties', title: 'Parties', fields: ['clientId', 'propertyId', 'dealType'] },
  {
    id: 'value',
    title: 'Value & fee',
    fields: ['agreedValue', 'feeBasis', 'feeRate', 'fixedFee', 'partnerShare', 'partnerName'],
  },
  { id: 'pipeline', title: 'Pipeline', fields: ['stage', 'details'] },
  { id: 'review', title: 'Review', fields: [] },
]);

/** Workbook text the editor shows, by `details` key; the other allowlisted keys round-trip. */
export const detailFields = Object.freeze([
  { key: 'opened_date', label: 'Opened date', type: 'date' },
  { key: 'target_close_date', label: 'Target close date', type: 'date' },
  { key: 'next_deal_action', label: 'Next deal action', type: 'text' },
  { key: 'next_action_due', label: 'Next action due', type: 'date' },
  { key: 'document_status', label: 'Document status', type: 'text' },
  { key: 'closed_date', label: 'Closed date', type: 'date' },
  { key: 'lost_cancelled_reason', label: 'Lost / cancelled reason', type: 'text' },
  { key: 'notes', label: 'Notes', type: 'textarea' },
]);

const aed = (fils) => (fils === null || fils === undefined ? '' : filsToAed(fils));
const percent = (bp) => (bp === null || bp === undefined ? '' : bpToPercent(bp));

/** Editable text for a new deal (`clientId` optional) or a parsed DealView. */
export function draftFromDeal(deal, clientId = '') {
  return {
    clientId: deal?.clientId ?? clientId,
    propertyId: deal?.propertyId ?? '',
    dealType: deal?.dealType ?? dealTypes[0],
    stage: deal?.stage ?? dealStages[0],
    agreedValue: aed(deal?.agreedValueFils),
    feeBasis: deal?.feeBasis ?? 'percentage',
    feeRate: percent(deal?.feeRateBp),
    fixedFee: aed(deal?.fixedFeeFils),
    partnerShare: deal ? percent(deal.partnerShareBp) : '',
    partnerName: deal?.partnerName ?? '',
    details: { ...(deal?.details ?? {}) },
  };
}

function money(text, required, errors, key) {
  const { value, error } = parseAed(text);
  if (error) errors[key] = error;
  else if (value === null && required) errors[key] = requiredMessages[key];
  else if (value !== null && value > DEAL_MAX_FILS) errors[key] = dealCapMessage;
  return errors[key] ? null : value;
}

function share(text, required, errors, key) {
  const { value, error } = parsePercent(text);
  if (error) errors[key] = error;
  else if (value === null && required) errors[key] = requiredMessages[key];
  return errors[key] ? null : value;
}

/**
 * `{ body, errors }`: the exact `deal` object for `POST`/`PATCH` when `errors` is empty.
 * `body` is null while any field is invalid.
 */
export function dealBodyFromDraft(form) {
  const errors = {};
  if (!form.clientId) errors.clientId = requiredMessages.clientId;
  const fixed = form.feeBasis === 'fixed';
  const agreedValueFils = money(form.agreedValue, true, errors, 'agreedValue');
  // Only the chosen fee basis is read; the other field is cleared, never validated.
  const feeRateBp = fixed ? null : share(form.feeRate, true, errors, 'feeRate');
  const fixedFeeFils = fixed ? money(form.fixedFee, true, errors, 'fixedFee') : null;
  const partnerShareBp = share(form.partnerShare, false, errors, 'partnerShare') ?? 0;
  if (!dealTypes.includes(form.dealType)) errors.dealType = 'Choose a valid deal type.';
  if (!dealStages.includes(form.stage)) errors.stage = 'Choose a valid deal stage.';
  const details = Object.fromEntries(
    Object.entries(form.details ?? {}).filter(([, text]) => String(text ?? '').trim()),
  );
  if (Object.keys(errors).length) return { body: null, errors };
  return {
    errors,
    body: {
      clientId: form.clientId,
      propertyId: form.propertyId || null,
      dealType: form.dealType,
      stage: form.stage,
      agreedValueFils,
      feeBasis: fixed ? 'fixed' : 'percentage',
      feeRateBp,
      fixedFeeFils,
      partnerShareBp,
      partnerName: form.partnerName.trim() || null,
      details,
    },
  };
}

/** Errors that belong to one step, so the editor validates a section before advancing. */
export function stepErrors(form, stepId) {
  const step = dealSteps.find((item) => item.id === stepId);
  const { errors } = dealBodyFromDraft(form);
  return Object.fromEntries(
    Object.entries(errors).filter(([key]) => step?.fields.includes(key) || stepId === 'review'),
  );
}

/** True when the draft differs from where it started (protects unsaved work). */
export const draftChanged = (form, initial) => JSON.stringify(form) !== JSON.stringify(initial);
