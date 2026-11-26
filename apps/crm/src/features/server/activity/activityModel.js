import { schema } from '../../../lib/schema.js';
import { actionOf, sections } from './activityVocabulary.js';
import { shiftDay } from './activityFilters.js';
import { dubaiClock, dubaiToday } from '../../../lib/dubaiDate.js';

export { initials } from '../profile/profileModel.js';

export const UNAVAILABLE = 'Record unavailable';

/** The Dubai calendar day (`YYYY-MM-DD`) of a UTC ISO timestamp. */
export const dubaiDay = (at) => dubaiToday(at);

/** "14:05", Dubai time, 24-hour as elsewhere in the CRM. */
export const timeLabel = (at) => dubaiClock(at);

const dayFormat = new Intl.DateTimeFormat('en-GB', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});

/** "Today", "Yesterday" or "Wednesday 14 October 2026". */
export function dayLabel(day, today) {
  if (day === today) return 'Today';
  if (day === shiftDay(today, -1)) return 'Yesterday';
  return dayFormat.format(new Date(`${day}T00:00:00Z`)).replace(',', '');
}

const shortFormat = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});

/** "18 Jul 2026 – 16 Oct 2026" for an inclusive Dubai day range. */
export function rangeLabel({ from, to }) {
  const format = (day) => shortFormat.format(new Date(`${day}T00:00:00Z`));
  return from === to ? format(from) : `${format(from)} – ${format(to)}`;
}

/** Items in server order, grouped by Dubai day; every item appears exactly once. */
export function groupByDay(items, today) {
  const groups = [];
  for (const item of items) {
    const day = dubaiDay(item.at);
    let group = groups.at(-1);
    if (group?.day !== day) {
      const label = dayLabel(day, today);
      const relative = label === 'Today' || label === 'Yesterday';
      group = { day, label, date: relative ? rangeLabel({ from: day, to: day }) : '', items: [] };
      groups.push(group);
    }
    group.items.push(item);
  }
  return groups;
}

const nameFields = { Clients: 'full_name', Contacts: 'full_name', Properties: 'listing_title' };

function clientName(entries, clientId) {
  if (!clientId) return '';
  const client = (entries?.Clients || []).find((entry) => entry.record.client_id === clientId);
  return client?.record.full_name || '';
}

/**
 * A display name from records this session already loaded within its scope, else the record's
 * ID. A `null` record (deleted, hidden or unknown) is always unavailable.
 */
export function recordName(item, entries) {
  if (!item.record) return null;
  const { collection } = item;
  if (collection === 'Targets') return '';
  const entry = (entries?.[collection] || []).find((row) => row.id === item.record.id);
  const legacy = item.record.legacyId || '';
  if (!entry) return legacy;
  const field = nameFields[collection];
  if (field) return entry.record[field] || entry.record[schema(collection)[0].key] || legacy;
  const id = entry.record[schema(collection)[0].key] || legacy;
  const client = clientName(entries, entry.record.client_id);
  return client ? `${id} · ${client}` : id;
}

/**
 * The readable parts of one entry: "Layla earned deal DL-004", "You invited Omar Haddad",
 * "You connected WhatsApp" (channel words come from the catalogues through `t`). The
 * object is `null` when the target is unavailable, so the row can say so plainly.
 */
export function describe(item, { userId, entries, t }) {
  const action = actionOf(item);
  const actor = item.actor.id === userId ? 'You' : item.actor.name;
  const base = { actor, verb: action.verb, icon: action.icon, tone: action.tone };
  if (item.kind === 'channel') {
    const verb = t(`channels.activity.verb.${item.action}`);
    const object = t(`channels.channel.${item.channel}`);
    return { ...base, verb, noun: '', object, section: t('channels.title'), sectionIcon: 'chat' };
  }
  if (item.kind === 'team') {
    const member = item.member?.id === userId ? 'you' : item.member?.name || '';
    return { ...base, noun: '', object: action.self ? '' : member, section: 'Team' };
  }
  const section = sections[item.collection] || { noun: 'record', icon: 'note' };
  const name = recordName(item, entries);
  return {
    ...base,
    noun: name ? section.noun : `${/^[aeiou]/.test(section.noun) ? 'an' : 'a'} ${section.noun}`,
    object: name,
    section: item.collection,
    sectionIcon: section.icon,
  };
}
