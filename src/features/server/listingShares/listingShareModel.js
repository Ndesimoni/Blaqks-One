import { listingDetailKeys, propertyFactKeys } from '../finance/handoverPreviewModel.js';

/**
 * A listing shared with an agent at another company (docs/record-sharing.md R2, packet R2a).
 * Views are read strictly: only the listed facts, the two people, the dates, the status and
 * the actions the caller may take. Unknown shapes are refused outright.
 */
export const listingShareStatuses = Object.freeze([
  ...['pending', 'accepted', 'declined', 'withdrawn', 'stopped', 'ended', 'expired'],
]);
export const endReasons = Object.freeze([
  ...['holder_changed', 'listing_closed', 'listing_removed', 'member_left', 'company_closed'],
  'end_date',
]);
export const warningCodes = Object.freeze([
  ...['contact', 'links', 'inline', 'over', 'unavailable', 'pdf'],
]);
const actions = ['accept', 'decline', 'withdraw', 'stop', 'extend', 'evidence'];
const viewers = ['sender', 'agent', 'agentAdmin'];
export const factKeys = [...propertyFactKeys, ...listingDetailKeys];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const invalid = () => new Error('The server returned invalid listing share information.');
const isObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const uuid = (value) => {
  if (typeof value !== 'string' || !UUID.test(value)) throw invalid();
  return value;
};
const text = (value, max = 300) => {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string' || value.length > max) throw invalid();
  return value.trim() || null;
};
const stamp = (value) => {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string' || value.length > 40 || Number.isNaN(Date.parse(value)))
    throw invalid();
  return value;
};
const oneOf = (value, allowed, optional = false) => {
  if (optional && (value === null || value === undefined)) return null;
  if (!allowed.includes(value)) throw invalid();
  return value;
};

/** Only the known listing facts, as text. */
export function readFacts(value) {
  if (value === null) return null;
  if (!isObject(value)) throw invalid();
  const kept = factKeys.filter((key) => typeof value[key] === 'string');
  return Object.freeze(Object.fromEntries(kept.map((key) => [key, text(value[key], 20000)])));
}

const files = (value, thumbs) => {
  if (!Array.isArray(value)) throw invalid();
  return Object.freeze(
    value.map((item) =>
      Object.freeze({
        name: text(item?.name, 120) || '',
        file: uuid(item?.file),
        thumb: thumbs && item?.thumb ? uuid(item.thumb) : null,
      }),
    ),
  );
};

const person = (value, contact) => {
  if (!isObject(value)) throw invalid();
  return Object.freeze({
    id: uuid(value.id),
    name: text(value.name, 200),
    company: text(value.company, 200),
    ...(contact ? { phone: text(value.phone, 40), email: text(value.email, 254) } : {}),
  });
};

/** One share view, frozen. */
export function readListingShare(value) {
  if (!isObject(value) || !isObject(value.allowed)) throw invalid();
  if (!actions.every((action) => typeof value.allowed[action] === 'boolean')) throw invalid();
  if (!/^LS-[A-Z0-9]{8}$/.test(value.reference)) throw invalid();
  return Object.freeze({
    id: uuid(value.id),
    reference: value.reference,
    label: text(value.label) || value.reference,
    side: oneOf(value.side, ['sender', 'recipient']),
    viewer: oneOf(value.viewer, viewers),
    from: person(value.from, true),
    to: person(value.to, false),
    status: oneOf(value.status, listingShareStatuses),
    endReason: oneOf(value.endReason, endReasons, true),
    createdAt: stamp(value.createdAt),
    offerEndsAt: stamp(value.offerEndsAt),
    viewEndsAt: stamp(value.viewEndsAt),
    decidedAt: stamp(value.decidedAt),
    openedAt: stamp(value.openedAt),
    closedAt: stamp(value.closedAt),
    note: text(value.note, 500),
    declinedAsKnown: value.declinedAsKnown === true,
    exactLocation: value.exactLocation === true,
    listing: readFacts(value.listing ?? null),
    photos: files(value.photos, true),
    floorPlans: files(value.floorPlans, false),
    recordId: value.recordId === null ? null : uuid(value.recordId),
    allowed: Object.freeze(Object.fromEntries(actions.map((name) => [name, value.allowed[name]]))),
  });
}

export const readListingShareResult = (value) => readListingShare(value?.share);

export function readListingShareList(value) {
  if (!isObject(value) || !Array.isArray(value.shares)) throw invalid();
  return Object.freeze(value.shares.map(readListingShare));
}

/** `POST /listing-shares/preview`: what the agent sees before and after accepting. */
export function readPreview(value) {
  if (!isObject(value) || !isObject(value.files) || !Array.isArray(value.warnings)) throw invalid();
  if (!/^[0-9a-f]{64}$/.test(value.previewDigest)) throw invalid();
  const names = (list) => (Array.isArray(list) ? list.map((name) => text(name, 120) || '') : []);
  return Object.freeze({
    before: readFacts(value.before),
    after: readFacts(value.after),
    photos: names(value.files.photos),
    floorPlans: names(value.files.floorPlans),
    warnings: value.warnings.filter((code) => warningCodes.includes(code)),
    previewDigest: value.previewDigest,
  });
}
