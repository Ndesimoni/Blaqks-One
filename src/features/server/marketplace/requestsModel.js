/**
 * The client requests' answers, read strictly (packet MK2): a known purpose, emirate and band, a
 * state the marketplace defines, whole numbers where numbers are asked for and dates that parse.
 * Anything else is refused rather than half-shown.
 */
export const requestStates = Object.freeze(['open', 'expired', 'closed']);
export const purposes = Object.freeze(['buy', 'rent']);
export const emirateSlugs = Object.freeze([
  'dubai',
  'abu-dhabi',
  'sharjah',
  'ajman',
  'umm-al-quwain',
  'ras-al-khaimah',
  'fujairah',
]);
export const readyChoices = Object.freeze(['ready', 'off_plan', 'any']);
export const furnishingChoices = Object.freeze([
  'furnished',
  'unfurnished',
  'part_furnished',
  'any',
]);
export const ageChoices = Object.freeze(['new', 'under_5', '5_to_10', 'over_10', 'any']);
export const chequesChoices = Object.freeze([1, 2, 3, 4, 6, 12]);
export const bands = Object.freeze([
  'buy_1m',
  'buy_2m',
  'buy_3m',
  'buy_5m',
  'buy_10m',
  'buy_10m_plus',
  'rent_50k',
  'rent_100k',
  'rent_150k',
  'rent_250k',
  'rent_500k',
  'rent_500k_plus',
]);

import {
  id,
  invalid,
  isObject,
  maybeOneOf,
  maybeWhole,
  money,
  names,
  oneOf,
  stamp,
  text,
  whole,
} from './requestsFields.js';

/** `{ requirements: {...} }` from `GET /requests/draft`: only the allowlisted fields. */
export function readRequirements(value) {
  if (!isObject(value) || !isObject(value.requirements)) throw invalid();
  const found = value.requirements;
  return {
    purpose: maybeOneOf(found.purpose, purposes),
    emirate: maybeOneOf(found.emirate, emirateSlugs),
    communities: names(found.communities ?? []),
    propertyType: text(found.propertyType, 60),
    bedrooms: maybeWhole(found.bedrooms),
    budgetMinAed: money(found.budgetMinAed),
    budgetMaxAed: money(found.budgetMaxAed),
    moveIn: text(found.moveIn, 7),
  };
}

/** One card's shared facts, on the board and in My requests. */
function readFacts(value) {
  if (!isObject(value)) throw invalid();
  return {
    id: id(value.id),
    purpose: oneOf(value.purpose, purposes),
    emirate: oneOf(value.emirate, emirateSlugs),
    communities: names(value.communities ?? []),
    openToOtherAreas: value.openToOtherAreas === true,
    propertyType: text(value.propertyType, 60),
    bedrooms: maybeWhole(value.bedrooms),
    budgetBand: oneOf(value.budgetBand, bands),
    ready: oneOf(value.ready, readyChoices),
    furnishing: oneOf(value.furnishing, furnishingChoices),
    cheques:
      value.cheques === null || value.cheques === undefined
        ? null
        : oneOf(value.cheques, chequesChoices),
    buildingAge: oneOf(value.buildingAge, ageChoices),
    moveIn: text(value.moveIn, 7),
    createdAt: stamp(value.createdAt),
    expiresAt: stamp(value.expiresAt),
  };
}

function readBroker(value) {
  if (!isObject(value)) throw invalid();
  return {
    memberId: id(value.memberId),
    name: text(value.name, 120),
    company: text(value.company, 120),
    hasPhoto: value.hasPhoto === true,
  };
}

/** `{ requests, nextCursor }` from `GET /board`; no totals are read because none are sent. */
export function readBoard(value) {
  if (!isObject(value) || !Array.isArray(value.requests)) throw invalid();
  const requests = value.requests.map((card) => ({
    ...readFacts(card),
    broker: readBroker(card.broker),
    yourCompany: card.yourCompany === true,
  }));
  const nextCursor = value.nextCursor === null ? '' : text(value.nextCursor, 200);
  return { requests, nextCursor };
}

/** `{ requests: [...] }` from `GET /requests/mine`, with the poster's own client and state. */
export function readMyRequests(value) {
  if (!isObject(value) || !Array.isArray(value.requests)) throw invalid();
  return value.requests.map((row) => ({
    ...readFacts(row),
    clientId: text(row.clientId, 200),
    clientName: text(row.clientName, 120),
    state: oneOf(row.state, requestStates),
    canRenew: row.canRenew === true,
    version: whole(row.version),
    budgetMinAed: money(row.budgetMinAed),
    budgetMaxAed: money(row.budgetMaxAed),
  }));
}

/** `{ request }` after posting, editing, renewing or closing. */
export function readOneRequest(value) {
  if (!isObject(value) || !isObject(value.request)) throw invalid();
  return readMyRequests({ requests: [value.request] })[0];
}
