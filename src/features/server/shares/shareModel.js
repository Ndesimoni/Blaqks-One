/**
 * Sharing one record with a colleague (docs/record-sharing.md, "R1 API contract"). A share
 * reads as its type, a label, the two members, its status and dates, and the actions the
 * caller may take — never another record field. Unknown shapes are refused outright.
 */
export const shareCollections = Object.freeze(['Clients', 'Properties', 'Contacts']);
export const shareStatuses = Object.freeze([
  'pending',
  'accepted',
  'declined',
  'withdrawn',
  'stopped',
  'ended',
  'expired',
]);
export const SHARE_ROUTE = 'Shared record';
const actions = ['accept', 'decline', 'withdraw', 'stop'];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const LINK = /^\/shares\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/;

const invalid = () => new Error('The server returned invalid sharing information.');
const isObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const uuid = (value) => {
  if (typeof value !== 'string' || !UUID.test(value)) throw invalid();
  return value;
};
const text = (value, max = 200) => {
  if (typeof value !== 'string' || !value.trim() || value.length > max) throw invalid();
  return value;
};
const stamp = (value, optional = false) => {
  if (optional && (value === null || value === undefined)) return null;
  if (typeof value !== 'string' || value.length > 40 || Number.isNaN(Date.parse(value)))
    throw invalid();
  return value;
};
const member = (value) => Object.freeze({ id: uuid(value?.id), name: text(value?.name) });

/** One share view, frozen; a blank or missing label (closed shares) reads as null. */
export function readShare(value) {
  if (!isObject(value) || !isObject(value.allowed)) throw invalid();
  if (!shareCollections.includes(value.collection) || !shareStatuses.includes(value.status))
    throw invalid();
  if (!actions.every((action) => typeof value.allowed[action] === 'boolean')) throw invalid();
  const label = value.label ?? null;
  if (label !== null && (typeof label !== 'string' || label.length > 300)) throw invalid();
  return Object.freeze({
    id: uuid(value.id),
    collection: value.collection,
    label: label?.trim() ? label : null,
    from: member(value.from),
    to: member(value.to),
    status: value.status,
    createdAt: stamp(value.createdAt),
    expiresAt: stamp(value.expiresAt, true),
    decidedAt: stamp(value.decidedAt, true),
    closedAt: stamp(value.closedAt, true),
    allowed: Object.freeze(Object.fromEntries(actions.map((name) => [name, value.allowed[name]]))),
  });
}

/** `{ incoming, outgoing }` from `GET /shares`. */
export function readShareList(value) {
  if (!isObject(value) || !Array.isArray(value.incoming) || !Array.isArray(value.outgoing))
    throw invalid();
  return Object.freeze({
    incoming: Object.freeze(value.incoming.map(readShare)),
    outgoing: Object.freeze(value.outgoing.map(readShare)),
  });
}

/** `{ share }` from a create, a read or a decision. */
export const readShareResult = (value) => readShare(value?.share);

/** The colleagues who may receive a record, from `GET /shares/candidates`. */
export function readCandidates(value) {
  if (!isObject(value) || !Array.isArray(value.colleagues)) throw invalid();
  return Object.freeze(value.colleagues.map(member));
}

/** Pending shares the caller can still answer, for one collection. */
export const waitingFor = (list, collection) =>
  (list?.incoming || []).filter(
    (share) =>
      share.collection === collection && share.status === 'pending' && share.allowed.accept,
  );

/** The share ID of an exact `/shares/{uuid}` route, or null for any other path. */
export const shareLinkId = (pathname) => LINK.exec(pathname || '')?.[1] ?? null;

/** The route name of a share link, for the connected navigation. */
export const shareRoute = (pathname) => (shareLinkId(pathname) ? SHARE_ROUTE : null);

/** The link a colleague opens: only the share's ID, and only in the fragment. */
export const shareLink = (origin, id) => `${origin}/#/shares/${uuid(id)}`;

/**
 * The WhatsApp message: the sender's name, the type word and the link, nothing from the
 * record (amendment 7). `t` is the English catalogue's translator.
 */
export function whatsAppText(t, sender, collection, link) {
  if (!shareCollections.includes(collection)) throw invalid();
  const type = t(`recordShares.article.${collection}`);
  return t('recordShares.whatsApp', { name: sender, type, link });
}

/** Opens the phone's own WhatsApp with the message ready to send; no provider is involved. */
export const whatsAppUrl = (message) => `https://wa.me/?text=${encodeURIComponent(message)}`;

/** Whether the caller may offer this record: its holder or the company Admin. */
export const canShareRecord = (user, entry) =>
  Boolean(entry && user && (user.roleId === 'admin' || entry.assignee === user.id));
