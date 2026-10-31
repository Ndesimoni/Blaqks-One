/**
 * Pure helpers for mentions in team chat (packet C3). A mention travels to the server as the
 * member's ID; the text only shows `@Name`, which the thread highlights for the IDs the
 * server stored with the message.
 */

export const MENTION_LIMIT = 20;

/** `@` at the start or after a space, then up to 40 characters of search, at the caret. */
const SEARCH = /(?:^|\s)@([^@\n]{0,40})$/;

/** The `@search` typed just before the caret, as `{ start, query }`, or null. */
export function mentionQuery(text = '', caret = text.length) {
  const match = SEARCH.exec(text.slice(0, caret));
  if (!match || /^\s/.test(match[1])) return null;
  return { start: caret - match[1].length - 1, query: match[1] };
}

/** Colleagues with a word of their name starting with each word typed after `@`. */
export function matchMentions(people = [], query = '') {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  return people.filter((person) => {
    const parts = person.name.toLowerCase().split(/\s+/);
    return words.every((word) => parts.some((part) => part.startsWith(word)));
  });
}

/** The text with the `@search` from `start` replaced by `@Name `, and the caret after it. */
export function insertMention(text, search, name) {
  const before = text.slice(0, search.start);
  const after = text.slice(search.start + 1 + search.query.length).replace(/^ /, '');
  const inserted = `@${name} `;
  return { text: before + inserted + after, caret: before.length + inserted.length };
}

/** The chosen colleagues whose `@Name` is still in the text: the IDs to send. */
export function keptMentions(text = '', chosen = []) {
  const ids = chosen
    .filter((person) => person.name && text.includes(`@${person.name}`))
    .map((person) => person.id);
  return [...new Set(ids)].slice(0, MENTION_LIMIT);
}

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * The text in parts: plain text, and `@Name` for each mentioned member (`named`: their IDs
 * and names; longer names match first). Text only — never markup.
 */
export function mentionParts(body = '', named = []) {
  const names = named.filter((item) => item.name).sort((a, b) => b.name.length - a.name.length);
  if (!names.length || !body) return [{ text: body }];
  const pattern = new RegExp(`@(${names.map((item) => escapeRegExp(item.name)).join('|')})`, 'g');
  const parts = [];
  let last = 0;
  for (const match of body.matchAll(pattern)) {
    if (match.index > last) parts.push({ text: body.slice(last, match.index) });
    parts.push({ text: match[0], id: names.find((item) => item.name === match[1]).id });
    last = match.index + match[0].length;
  }
  if (last < body.length) parts.push({ text: body.slice(last) });
  return parts;
}
