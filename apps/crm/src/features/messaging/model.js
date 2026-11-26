import { normalizeEmail, normalizePhone, validPhone } from '../team/model.js';

export const MAX_RECIPIENTS = 100;
export const MAX_RECIPIENT_TEXT = 20000;
export const validEmail = (value) =>
  typeof value === 'string' &&
  value.length <= 254 &&
  /^[^\s@,;<>()\[\]:"\\]+@[^\s@,;<>()\[\]:"\\]+\.[^\s@,;<>()\[\]:"\\]+$/.test(value);
export const recipientField = (channel) => `${channel}Recipients`;
export const hasMessagingAccess = (user) =>
  Boolean(user?.channelAccess?.email || user?.channelAccess?.whatsapp);
export const plannedSender = (user, channel) =>
  channel === 'email' ? user.email : 'Keys with Simoni business WhatsApp';

// Spaces stay inside phone numbers; recipients are separated by commas, semicolons or lines.
export function parseRecipients(raw, channel) {
  const recipients = [],
    invalid = [],
    seen = new Set();
  let duplicateCount = 0;
  const text = String(raw || '');
  if (!['email', 'whatsapp'].includes(channel) || text.length > MAX_RECIPIENT_TEXT)
    return { recipients, invalid, duplicateCount, tooLong: true };
  for (const entry of text
    .split(/[,;\r\n]+/)
    .map((value) => value.trim())
    .filter(Boolean)) {
    const value = channel === 'email' ? normalizeEmail(entry) : normalizePhone(entry);
    if (!(channel === 'email' ? validEmail(value) : validPhone(value))) {
      invalid.push(entry);
      continue;
    }
    if (seen.has(value)) {
      duplicateCount++;
      continue;
    }
    seen.add(value);
    recipients.push(value);
  }
  return { recipients, invalid, duplicateCount, tooLong: false };
}

export function appendRecipient(raw, address, channel) {
  const parsed = parseRecipients(raw, channel);
  const added = parseRecipients(address, channel);
  if (added.invalid.length || added.tooLong || added.recipients.length !== 1) return raw;
  return parsed.recipients.includes(added.recipients[0])
    ? raw
    : [String(raw || '').trim(), added.recipients[0]].filter(Boolean).join('\n');
}

// Removing a chip also removes repeated copies, while retaining unrelated and invalid entries.
export function removeRecipient(raw, address, channel) {
  const removed = parseRecipients(address, channel);
  if (removed.invalid.length || removed.tooLong || removed.recipients.length !== 1) return raw;
  return String(raw || '')
    .split(/[,;\r\n]+/)
    .map((entry) => entry.trim())
    .filter(Boolean)
    .filter((entry) => !parseRecipients(entry, channel).recipients.includes(removed.recipients[0]))
    .join('\n');
}

export function createMessageDraft(user, client, requestedChannel) {
  const available = ['whatsapp', 'email'].filter((channel) => user?.channelAccess?.[channel]);
  const channel = available.includes(requestedChannel)
    ? requestedChannel
    : available.find((key) =>
        key === 'email' ? validEmail(client?.email) : validPhone(client?.phone),
      ) ||
      available[0] ||
      'whatsapp';
  return {
    channel,
    emailRecipients: client?.email || '',
    whatsappRecipients: client?.phone || '',
    subject: '',
    body: '',
  };
}

export function validateAudience(form, user) {
  const errors = {};
  if (!['email', 'whatsapp'].includes(form.channel) || !user?.channelAccess?.[form.channel])
    errors.channel = 'Your Super Admin has not allowed this messaging channel.';
  const field = recipientField(form.channel);
  const parsed = parseRecipients(form[field], form.channel);
  if (parsed.tooLong) errors[field] = 'This recipient list is too long. Use a shorter list.';
  else if (parsed.invalid.length)
    errors[field] =
      `Check ${parsed.invalid.length} invalid ${parsed.invalid.length === 1 ? 'recipient' : 'recipients'}: ${parsed.invalid.slice(0, 3).join(', ')}${parsed.invalid.length > 3 ? '…' : ''}. ${form.channel === 'email' ? 'Enter plain email addresses.' : 'Include the country code for every number.'}`;
  else if (!parsed.recipients.length)
    errors[field] =
      `Enter at least one ${form.channel === 'email' ? 'email address' : 'WhatsApp number'}.`;
  else if (parsed.recipients.length > MAX_RECIPIENTS)
    errors[field] = `Use up to ${MAX_RECIPIENTS} recipients per preview.`;
  return errors;
}

export function validateMessage(form) {
  return {
    ...(!form.body?.trim() ? { body: 'Write a message to preview.' } : {}),
    ...(form.channel === 'email' && !form.subject?.trim()
      ? { subject: 'Enter an email subject.' }
      : {}),
  };
}

// This payload is a local preview only. No delivery transport or persistence is invoked.
export function createMessagePreview(form, user) {
  const errors = { ...validateAudience(form, user), ...validateMessage(form) };
  if (Object.keys(errors).length) {
    const error = Error('Check the highlighted fields before previewing.');
    error.fields = errors;
    throw error;
  }
  return {
    channel: form.channel,
    recipients: parseRecipients(form[recipientField(form.channel)], form.channel).recipients,
    subject: form.channel === 'email' ? form.subject.trim() : '',
    body: form.body.trim(),
    sender: plannedSender(user, form.channel),
    deliveryMode: 'individual',
    status: 'preview',
  };
}
