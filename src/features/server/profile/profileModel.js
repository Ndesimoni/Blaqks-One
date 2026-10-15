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

export function channelSummary(user) {
  const channels = [
    ['email', 'Email'],
    ['whatsapp', 'WhatsApp'],
  ].filter(([key]) => user?.channelAccess?.[key] === true);
  return channels.length ? channels.map(([, label]) => label).join(' and ') : 'None';
}

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

export function detailsError(form) {
  const name = form.name.trim();
  if (!name || [...name].length > 100)
    return { field: 'name', message: 'Enter a name of 1 to 100 characters.' };
  if (!/^\+\d{7,15}$/.test(form.phone.trim()))
    return {
      field: 'phone',
      message: 'Enter a phone number including country code, such as +971501234567.',
    };
  return null;
}

export const deviceLabel = (session) => session.device || 'Unknown browser';
