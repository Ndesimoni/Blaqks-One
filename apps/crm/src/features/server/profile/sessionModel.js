import { formatStamp } from './profileModel.js';

export const deviceLabel = (session) => session.device || 'Unknown browser';

/** Desktop or mobile, from the server's coarse "Browser · OS" label. */
export const deviceKind = (session) =>
  /\b(iOS|iPhone|iPad|iPadOS|Android|Mobile)\b/i.test(session?.device || '') ? 'mobile' : 'desktop';

const minute = 60 * 1000;
const hour = 60 * minute;
const day = 24 * hour;
const plural = (count, unit) => `${count} ${unit}${count === 1 ? '' : 's'} ago`;

/** "just now", "5 min ago", "3 hours ago", "2 days ago", then the UAE date and time. */
export function relativeTime(value, now = Date.now()) {
  const time = new Date(value).getTime();
  if (!value || Number.isNaN(time)) return '';
  const elapsed = Math.max(0, now - time);
  if (elapsed < minute) return 'just now';
  if (elapsed < hour) return `${Math.floor(elapsed / minute)} min ago`;
  if (elapsed < day) return plural(Math.floor(elapsed / hour), 'hour');
  if (elapsed < 7 * day) return plural(Math.floor(elapsed / day), 'day');
  return formatStamp(value);
}

/** This device first, then the most recently active. Returns a new array. */
export function sortSessions(sessions) {
  const seen = (session) => new Date(session.lastSeenAt || session.createdAt).getTime() || 0;
  return [...sessions].sort(
    (a, b) => Number(Boolean(b.current)) - Number(Boolean(a.current)) || seen(b) - seen(a),
  );
}
