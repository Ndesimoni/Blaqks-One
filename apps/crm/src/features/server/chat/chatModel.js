/** Pure helpers for team chat (C2, groups in C3). */

const nameIn = (people, id) => people.find((person) => person.id === id)?.name;

/** A group's members other than the caller, by name; colleagues who left are skipped. */
export const groupNames = (room, people = []) =>
  (room?.members ?? []).map((id) => nameIn(people, id)).filter(Boolean);

/**
 * `#name` for a channel; a group's name, or its members' names; the colleague's name (or
 * "former member") for a direct room.
 */
export function roomTitle(room, people, t) {
  if (!room) return '';
  if (room.kind === 'channel') return `#${room.name}`;
  if (room.kind === 'group')
    return room.title || groupNames(room, people).join(', ') || t('chat.group.untitled');
  return nameIn(people, room.peerId) || t('chat.formerMember');
}

export const badge = (count) => (count > 99 ? '99+' : count > 0 ? String(count) : '');

/** Messages by ID (later copies win: edits and deletions), oldest first. */
export function mergeMessages(...lists) {
  const byId = new Map();
  for (const message of lists.flat()) byId.set(message.id, message);
  return [...byId.values()].sort((a, b) =>
    a.at === b.at ? (a.id < b.id ? -1 : 1) : a.at < b.at ? -1 : 1,
  );
}

const recent = (a, b) => (b.lastMessageAt ?? '').localeCompare(a.lastMessageAt ?? '');

/** Channels first (alphabetical), then groups and direct rooms, most recent first. */
export function splitRooms(rooms = []) {
  const channels = rooms
    .filter((room) => room.kind === 'channel')
    .sort((a, b) => a.name.localeCompare(b.name));
  const groups = rooms.filter((room) => room.kind === 'group').sort(recent);
  const direct = rooms.filter((room) => room.kind === 'direct').sort(recent);
  return { channels, groups, direct };
}

/** Who can be mentioned in a room: everyone in a channel, the members of a group. */
export function mentionable(room, people = []) {
  if (room?.kind === 'channel') return people;
  if (room?.kind === 'group') return people.filter((person) => room.members?.includes(person.id));
  return [];
}

/** Colleagues whose name matches every word of the search. */
export function matchPeople(people = [], query = '') {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  return people.filter((person) => words.every((word) => person.name.toLowerCase().includes(word)));
}

/** A channel name as the server will store it, for a live preview. */
export const channelSlug = (value = '') =>
  value.trim().replace(/^#/, '').toLowerCase().replace(/\s+/g, '-');

/** The day key of an ISO time in Dubai, to separate messages by day. */
export const dayOf = (at) => new Date(at).toLocaleDateString('en-CA', { timeZone: 'Asia/Dubai' });
