/**
 * Draft → the server's exact terms (services/crm-api/src/agreements/terms.rs), read field by
 * field with draftFields.js. Errors name the field and the catalogue reason. A draft made
 * from a listing share carries the server's `frozen` property, which is sent as it is.
 */
import { dubaiToday } from '../../../lib/dubaiDate.js';
import { BASES, PAYMENTS } from './agreementDraft.js';
import { choice, expiry, money, readShare, text, whole } from './draftFields.js';

export { readShare } from './draftFields.js';

export const STEP_FIELDS = {
  subject: [
    'emirate',
    'area',
    'propertyType',
    'bedrooms',
    'sizeSqft',
    'askingPrice',
    'listingRef',
    'clientName',
    'contact',
  ],
  money: [
    'basis',
    'amount',
    'senderShare',
    'paymentExpectation',
    'collectingParty',
    'governingEmirate',
    'expiresOn',
    'notes',
  ],
};

/** The typed property fields; none when the property is frozen. */
function propertyFields(draft) {
  if (draft.frozen) return {};
  return {
    emirate: text(draft.emirate, 40),
    area: text(draft.area, 80),
    propertyType: text(draft.propertyType, 40),
    bedrooms: whole(draft.bedrooms, 20),
    sizeSqft: whole(draft.sizeSqft, 1_000_000),
    askingPrice: money(draft.askingPrice),
    listingRef: text(draft.listingRef, 40),
  };
}

/** `{ terms, errors }`: terms in the server's shape when every field is valid, else null. */
export function readDraft(draft, today = dubaiToday()) {
  const fields = {
    ...propertyFields(draft),
    clientName: text(draft.clientName, 80),
    contact: draft.shareContact ? text(draft.contact, 120) : { value: null },
    basis: choice(draft.basis, BASES),
    amount: money(draft.amount),
    senderShare: readShare(draft.kind, draft.senderShare),
    paymentExpectation: choice(draft.paymentExpectation, PAYMENTS),
    collectingParty:
      draft.kind === 'co_broking'
        ? choice(draft.collectingParty, ['sender', 'recipient'])
        : { value: null },
    governingEmirate: text(draft.governingEmirate, 40),
    expiresOn: expiry(draft.expiresOn, today),
    notes: text(draft.notes, 2_000, true),
  };
  const errors = Object.fromEntries(Object.entries(fields).filter(([, field]) => field.error));
  if (Object.keys(errors).length) return { terms: null, errors };
  const value = (key) => fields[key].value;
  const terms = {
    property: draft.frozen ?? {
      emirate: value('emirate'),
      area: value('area'),
      propertyType: value('propertyType'),
      bedrooms: value('bedrooms'),
      sizeSqft: value('sizeSqft'),
      askingPriceFils: value('askingPrice'),
      listingRef: value('listingRef'),
    },
    client: { displayName: value('clientName'), contact: value('contact') },
    money: {
      basis: value('basis'),
      amountFils: value('amount'),
      senderShareBp: value('senderShare'),
      paymentExpectation: value('paymentExpectation'),
      ...(draft.kind === 'co_broking' ? { collectingParty: value('collectingParty') } : {}),
    },
    expiresAt: value('expiresOn'),
    governingEmirate: value('governingEmirate'),
    notes: value('notes'),
  };
  return { terms, errors: {} };
}

/** The errors of one form step. */
export const stepErrors = (errors, step) =>
  Object.fromEntries(Object.entries(errors).filter(([key]) => STEP_FIELDS[step]?.includes(key)));

/** Terms shaped like a stored revision's, for the review step before saving. */
export const previewTerms = (kind, terms) => ({
  kind,
  subject: { property: terms.property, client: terms.client },
  money: { ...terms.money, recipientShareBp: 10_000 - terms.money.senderShareBp },
  expiresAt: terms.expiresAt,
  governingEmirate: terms.governingEmirate,
  notes: terms.notes,
});
