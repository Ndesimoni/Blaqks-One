/**
 * Which record fields carry a guidance entry (packet Q1). The editor asks for a key only
 * for these, so fields without guidance never trigger missing-text warnings.
 */
const KEYS = Object.freeze({
  Clients: ['phone', 'preferred_channel', 'buy_rent', 'maximum_budget_aed'],
  Properties: [
    'price_annual_rent_aed',
    'price_basis',
    'ready_off_plan',
    'permit_reference',
    'minimum_stay_nights',
  ],
});

export const fieldHintKey = (module, key) =>
  KEYS[module]?.includes(key) ? `fieldHints.${module.toLowerCase()}.${key}` : '';
