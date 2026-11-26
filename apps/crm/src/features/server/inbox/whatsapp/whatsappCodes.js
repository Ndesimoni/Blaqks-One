/**
 * Server codes to catalogue keys for plain words (docs/whatsapp-design.md §11 and §18):
 * why a conversation's composer or a Start message cannot send, and why a message failed.
 * Keys are relative to the `whatsappSend` (composer, thread) or `whatsappStart` namespace.
 */
const REFUSALS = [
  'no_grant',
  'no_number',
  'unsupported',
  'other_number',
  'number_disconnected',
  'account_reconnect',
  'not_sendable',
  'opted_out',
];
const START_REFUSALS = [
  'no_grant',
  'no_number',
  'account_reconnect',
  'no_phone',
  'blocked',
  'opted_out',
  'no_agreement',
  'conversation_held',
];
const FAILURES = [
  'outside_window',
  'not_on_whatsapp',
  'whatsapp_limited',
  'template_not_delivered',
  'number_not_set_up',
  'whatsapp_refused',
  'not_sendable',
  'opted_out',
  'no_agreement',
  'sender_unavailable',
  'account_reconnect',
  'template_unavailable',
  'rate_limited',
  'provider_unavailable',
  'provider_unclear',
];

/** Why the conversation's composer cannot send (`whatsappSend`). */
export const refusalKey = (refusal) =>
  `refusal.${REFUSALS.includes(refusal) ? refusal : 'unsupported'}`;

/** Why Start message on WhatsApp cannot send yet (`whatsappStart`). */
export const startRefusalKey = (refusal) =>
  `refusal.${START_REFUSALS.includes(refusal) ? refusal : 'no_grant'}`;

/** A failed message's reason (`whatsappSend`); unknown codes read as refused by WhatsApp. */
export const failureKey = (code) =>
  `failure.${FAILURES.includes(code) ? code : 'whatsapp_refused'}`;
