/**
 * The co-broking part of a listing share view (docs/record-sharing.md R2), read strictly:
 * the agreement the share led to and the property a proposal would freeze, each null when
 * the server sends none. Unknown shapes are refused like the rest of the share.
 */
export const coBrokingStates = Object.freeze(['draft', 'sent', 'accepted', 'completed']);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const invalid = () => new Error('The server returned invalid listing share information.');
const absent = (value) => value === null || value === undefined;
const isObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const words = (value, max) => {
  if (absent(value)) return null;
  if (typeof value !== 'string' || value.length > max) throw invalid();
  return value;
};
const count = (value) => {
  if (absent(value)) return null;
  if (!Number.isSafeInteger(value) || value < 0) throw invalid();
  return value;
};

/** `{ id, state }` of the share's co-broking agreement, or null. */
export function readCoBroking(value) {
  if (absent(value)) return null;
  if (!isObject(value) || !UUID.test(value.id) || !coBrokingStates.includes(value.state))
    throw invalid();
  return Object.freeze({ id: value.id, state: value.state });
}

/** The §6 property facts a co-broking proposal from this share would freeze, or null. */
export function readCoBrokingProperty(value) {
  if (absent(value)) return null;
  if (!isObject(value)) throw invalid();
  return Object.freeze({
    emirate: words(value.emirate, 40),
    area: words(value.area, 80),
    propertyType: words(value.propertyType, 40),
    bedrooms: count(value.bedrooms),
    sizeSqft: count(value.sizeSqft),
    askingPriceFils: count(value.askingPriceFils),
    listingRef: words(value.listingRef, 40),
  });
}
