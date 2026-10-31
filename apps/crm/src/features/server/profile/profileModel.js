import { moduleLabels } from '../../server-team/model.js';

/** Dates and times in the UAE, matching the rest of the connected CRM. */
export function formatStamp(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('en-AE', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Dubai',
  });
}

/** "property-agent" → "Property Agent"; the server catalogue uses these title-cased labels. */
export const positionLabel = (id) =>
  String(id)
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

/** The modules the account can open, by their Team labels. */
export function permissionSummary(user) {
  const granted = Object.keys(moduleLabels).filter((key) => user?.permissions?.[key] === true);
  return granted.map((key) => moduleLabels[key]);
}

/** The messaging channels the account may use, by label. */
export const channelLabels = (user) =>
  [
    ['email', 'Email'],
    ['whatsapp', 'WhatsApp'],
  ]
    .filter(([key]) => user?.channelAccess?.[key] === true)
    .map(([, label]) => label);

export function recordScopeLabel(user) {
  return user?.recordScope === 'team' ? "Whole team's records" : 'Only records assigned to me';
}

/** Trimmed name and phone changes against the saved account, or null when nothing changed. */
export function detailsChanges(form, user) {
  const changes = {};
  if (form.name.trim() !== user.name) changes.name = form.name.trim();
  if (form.phone.trim() !== user.phone) changes.phone = form.phone.trim();
  return Object.keys(changes).length ? changes : null;
}

/** The error for one details field, or null; used on blur and before saving. */
export function detailsFieldError(field, form) {
  const value = String(form[field] || '').trim();
  if (field === 'name' && (!value || [...value].length > 100))
    return { field, message: 'Enter a name of 1 to 100 characters.' };
  if (field === 'phone' && !/^\+\d{7,15}$/.test(value))
    return {
      field,
      message: 'Enter a phone number including country code, such as +971501234567.',
    };
  return null;
}

export const detailsError = (form) =>
  detailsFieldError('name', form) || detailsFieldError('phone', form);

/** Up to two initials for the avatar. */
export const initials = (name) =>
  String(name || '?')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => [...word][0]?.toUpperCase() || '')
    .join('') || '?';

/** A stable avatar tone (0–3) from the account id, so each member keeps their colour. */
export function avatarTone(id) {
  let hash = 0;
  for (const character of String(id || '')) hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  return hash % 4;
}
