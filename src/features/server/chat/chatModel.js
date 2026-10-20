/** Pure helpers for team chat (C2). */

/** `#name` for a channel; the colleague's name (or "former member") for a direct room. */
export function roomTitle(room, people, t) {
  if (!room) return '';
  if (room.kind === 'channel') return `#${room.name}`;
  return people.find((person) => person.id === room.peerId)?.name || t('chat.formerMember');
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

/** Channels first (alphabetical), then direct rooms, most recent first. */
export function splitRooms(rooms = []) {
  const channels = rooms
    .filter((room) => room.kind === 'channel')
    .sort((a, b) => a.name.localeCompare(b.name));
  const direct = rooms
    .filter((room) => room.kind === 'direct')
    .sort((a, b) => (b.lastMessageAt ?? '').localeCompare(a.lastMessageAt ?? ''));
  return { channels, direct };
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
