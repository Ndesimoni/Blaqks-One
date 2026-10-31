import { dubaiToday, shiftDay } from '../../../lib/dubaiDate.js';

/**
 * Pure Inbox view logic (docs/messaging-integrations-plan.md U1): tabs and their API
 * filters, row wording, search over loaded rows, relative times and day groups. Words come
 * from the `inbox` catalogue through `t`.
 */
export const TABS = ['mine', 'unassigned', 'team', 'spam'];
export const CHANNELS = ['whatsapp', 'email', 'instagram', 'facebook', 'tiktok'];
export const POLL_MS = 10_000;

/** API filters for a tab plus the optional channel and state choices. */
export function listParams(tab, { channel = '', state = '' } = {}) {
  const base = {
    mine: { assignee: 'me', state: 'active' },
    unassigned: { assignee: 'unassigned', state: 'active' },
    team: { state: 'active' },
    spam: { state: 'spam' },
  }[tab] || { state: 'active' };
  return {
    ...base,
    ...(channel ? { channel } : {}),
    ...(state && tab !== 'spam' ? { state } : {}),
  };
}

/** The sender's best name: their stored name, else the phone, email or platform ID. */
export const contactTitle = (row) => row.contact?.name || row.contact?.display || '';

/** Two letters for the avatar; unknown senders show `?`. */
export function initials(row) {
  if (row.match !== 'linked' && !row.contact?.name) return '?';
  const words = contactTitle(row).trim().split(/\s+/).filter(Boolean);
  return (
    words
      .slice(0, 2)
      .map((word) => word[0].toUpperCase())
      .join('') || '?'
  );
}

/** The catalogue key for the row's status line, or '' when nothing needs saying. */
export function statusKey(row) {
  if (row.state === 'spam') return 'inbox.status.blocked';
  if (row.state === 'resolved') return 'inbox.status.resolved';
  if (row.match === 'choice') return 'inbox.status.choice';
  if (row.match === 'unknown')
    return row.suggestedLead ? 'inbox.status.suggested' : 'inbox.status.newContact';
  if (row.linked?.collection === 'Contacts') return 'inbox.status.contact';
  return 'inbox.status.client';
}

/** Keeps loaded rows whose name, address or latest message contains every search word. */
export function searchRows(rows, query) {
  const words = String(query || '')
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
  if (!words.length) return rows;
  return rows.filter((row) => {
    const text = [row.contact?.name, row.contact?.display, row.preview].join(' ').toLowerCase();
    return words.every((word) => text.includes(word));
  });
}

/** `{key, vars}` for "2m", "3h", "Yesterday" or a date, from a UTC timestamp. */
export function ageLabel(at, now = new Date()) {
  const minutes = Math.max(0, Math.round((now - new Date(at)) / 60_000));
  if (minutes < 1) return { key: 'inbox.age.now' };
  if (minutes < 60) return { key: 'inbox.age.minutes', vars: { count: minutes } };
  const day = dubaiToday(new Date(at));
  const today = dubaiToday(now);
  if (day === today) return { key: 'inbox.age.hours', vars: { count: Math.floor(minutes / 60) } };
  if (day === shiftDay(today, -1)) return { key: 'inbox.age.yesterday' };
  return { key: 'inbox.age.date', vars: { day } };
}

/**
 * Messages and internal notes in one time line, oldest first, grouped by Dubai day. Notes
 * keep `kind: 'note'` so they can never be drawn as a sent message.
 */
export function threadGroups(messages = [], notes = []) {
  const items = [
    ...messages.map((message) => ({ ...message, kind: 'message' })),
    ...notes.map((note) => ({ ...note, kind: 'note' })),
  ].sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : a.id < b.id ? -1 : 1));
  const groups = [];
  for (const item of items) {
    const day = dubaiToday(new Date(item.at));
    if (groups.at(-1)?.day !== day) groups.push({ day, items: [] });
    groups.at(-1).items.push(item);
  }
  return groups;
}

/** The connection state of a conversation's channel: connected, attention or off. */
export function channelHealth(channels = [], channel) {
  const live = channels.find((entry) => entry.channel === channel);
  if (!live) return 'off';
  return live.state === 'connected' ? 'connected' : 'attention';
}

/** Whether the member's account allows replying on this channel at all. */
export function canReplyOn(user, channel) {
  if (user?.roleId === 'admin') return true;
  if (channel === 'whatsapp') return user?.channelAccess?.whatsapp === true;
  if (channel === 'email') return user?.channelAccess?.email === true;
  return false;
}
