/**
 * Saved replies in the message box (docs/saved-replies-drafts.md §1 and §5): searching,
 * filling in `{client name}`, `{my name}` and `{company}`, and putting the text in the box.
 */
export const MAX_MESSAGE = 20000;

const FILL_IN = /\{(client name|my name|company)\}/gi;
// Zero-width, text-direction and control characters could disguise a name (review M1).
const HIDDEN =
  /[\u0000-\u001f\u007f-\u009f\u00ad\u061c\u180e\u200b-\u200f\u2028-\u202e\u2060-\u2069\ufeff\u{e0000}-\u{e007f}]/gu;
// An address, link or domain, or a number of six or more digits with any separators.
const LOOKS_UNSAFE = /@|:\/\/|www\.|[a-z0-9-]\.[a-z]{2,}\b|\d(?:[\s().-]*\d){5,}/i;

/** Replies whose title or text contains every word of the search, ignoring case. */
export function searchReplies(replies, query) {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return replies;
  return replies.filter((reply) => {
    const text = `${reply.title}\n${reply.body}`.toLowerCase();
    return words.every((word) => text.includes(word));
  });
}

/**
 * A client-supplied name made safe for a fill-in: hidden characters removed, one line of
 * at most 60 characters. '' when it looks like an address, link or long number, so the
 * fill-in stays as typed and the member writes the name themselves.
 */
export function safeName(name) {
  const clean = String(name ?? '')
    .replace(HIDDEN, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 60)
    .trim();
  return LOOKS_UNSAFE.test(clean) ? '' : clean;
}

/** The client's name: the linked record's when the member can see it, else the contact's. */
export function clientName(conversation) {
  const record = conversation?.record?.name;
  return safeName(record || conversation?.contact?.name || '');
}

/** Every fill-in replaced in one pass, ignoring case; one without a value stays as typed. */
export function fillIn(text, values) {
  const byName = {
    'client name': values.clientName,
    'my name': values.myName,
    company: values.company,
  };
  return text.replace(FILL_IN, (match, name) => byName[name.toLowerCase()] || match);
}

/** Fill-ins still left in a message, such as `{client name}`. */
export const leftFillIns = (text) => [...new Set(text.match(FILL_IN) ?? [])];

/**
 * The box's text with `insert` added: an empty box is replaced; otherwise it goes in at the
 * selection, on a new line when it would follow other text. `null` when it would not fit.
 */
export function insertReply(current, insert, start = current.length, end = start) {
  if (!current.trim())
    return insert.length > MAX_MESSAGE ? null : { text: insert, caret: insert.length };
  const before = current.slice(0, start);
  const joined = before && !before.endsWith('\n') ? `\n${insert}` : insert;
  const text = before + joined + current.slice(end);
  if (text.length > MAX_MESSAGE) return null;
  return { text, caret: before.length + joined.length };
}
