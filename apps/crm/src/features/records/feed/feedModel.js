import { get } from '../../../lib/records.js';

/** Interaction log fields the feed reads, by workbook name; stored keys are unchanged. */
export const feedFields = {
  id: 'Log ID',
  when: 'Contacted on UAE time',
  client: 'Client ID',
  property: 'Property ID optional',
  channel: 'Channel',
  direction: 'Direction',
  topic: 'Conversation topic',
  summary: 'Conversation summary / client needs',
  next: 'Next action',
  due: 'Action due',
  status: 'Action status',
};

const MOMENT = /^(\d{4}-\d{2}-\d{2})(?:[T ](\d{2}:\d{2}))?/;

/** The UAE day and wall-clock time of a contact, read from the stored text as written. */
export function feedMoment(value) {
  const match = MOMENT.exec(String(value ?? '').trim());
  return match ? { day: match[1], time: match[2] || '' } : { day: '', time: '' };
}

const momentKey = (record) => {
  const { day, time } = feedMoment(get(record, feedFields.when));
  return day ? `${day} ${time || '00:00'}` : '';
};

/** Newest conversation first; conversations without a contact date follow in their order. */
export function orderFeed(records) {
  return records
    .map((record, index) => ({ record, index, key: momentKey(record) }))
    .sort((a, b) => (a.key === b.key ? a.index - b.index : a.key < b.key ? 1 : -1))
    .map((item) => item.record);
}

/** Consecutive conversations grouped by contact day, keeping the feed's order. */
export function groupFeed(records) {
  const groups = [];
  for (const record of records) {
    const { day } = feedMoment(get(record, feedFields.when));
    const last = groups[groups.length - 1];
    if (last && last.day === day) last.records.push(record);
    else groups.push({ day, records: [record] });
  }
  return groups;
}

/** Conversations per contact day across every filtered record, not only the current page. */
export function dayCounts(records) {
  const counts = new Map();
  for (const record of records) {
    const { day } = feedMoment(get(record, feedFields.when));
    counts.set(day, (counts.get(day) || 0) + 1);
  }
  return counts;
}

/** `today`, `yesterday` or `noDate` for a day heading; other days show their date. */
export function dayLabelKey(day, today, yesterday) {
  if (!day) return 'noDate';
  if (day === today) return 'today';
  return day === yesterday ? 'yesterday' : '';
}

const channelKinds = [
  [/whats\s*app/i, 'whatsapp'],
  [/\bsms\b|\btext\b/i, 'sms'],
  [/phone|call/i, 'phone'],
  [/e-?mail/i, 'mail'],
  [/person|meeting|visit/i, 'meeting'],
];

/** The icon kind for a conversation's channel; other or custom channels show a note. */
export function channelKind(channel) {
  const text = String(channel ?? '');
  return channelKinds.find(([pattern]) => pattern.test(text))?.[1] || 'note';
}

/**
 * How a conversation's title joins the channel to the client, as the approved mockup's feed
 * reads ("Call with Layla Haddad", "Email to Omar Farouk", "WhatsApp from Priya Nair"): calls
 * and meetings are "with"; other channels are "to" when outbound, "from" when inbound.
 */
export function feedWay(kind, direction) {
  if (kind === 'phone' || kind === 'meeting') return 'with';
  const value = String(direction ?? '').trim();
  return /^out/i.test(value) ? 'to' : /^in/i.test(value) ? 'from' : 'with';
}
