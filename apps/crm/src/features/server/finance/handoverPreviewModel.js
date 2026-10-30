/**
 * `GET /finance/handovers/{id}/preview` (agreements design §17, "H2 API contract"): what the
 * receiver, the chosen approver or the Admin sees before deciding. The server leaves out the
 * client's contact, notes, documents and every record ID; this reader keeps only the listed
 * fields, so nothing else a response carried can reach the screen.
 */
import { dealStages, dealTypes, feeBases } from './dealModel.js';
import { readHandover } from './dealResponses.js';
import {
  boolean,
  bp,
  fils,
  object,
  oneOf,
  optional,
  text,
  total,
  version,
} from './financeValues.js';

/** A displayed fact: text, or a finite number shown as text; anything else is "not recorded". */
const fact = (value) => {
  if (typeof value === 'string') return value.trim() || null;
  return typeof value === 'number' && Number.isFinite(value) ? String(value) : null;
};

export const propertyFactKeys = [
  'listingTitle',
  'saleRental',
  'emirate',
  'community',
  'building',
  'propertyType',
  'bedrooms',
  'bathrooms',
  'sizeSqft',
  'priceAed',
  'readyOffPlan',
  'furnishing',
];

/** H3 (agreements design §18): the rest of the listing, shown only when recorded. */
export const listingDetailKeys = [
  ...['unitReference', 'priceBasis', 'listingStatus', 'availableFrom', 'rentalCheques'],
  ...['depositAed', 'minimumStayNights', 'maximumGuests', 'parkingSpaces', 'address'],
  ...['amenities', 'description', 'keySellingPoints', 'mapLink', 'listingUrl'],
  ...['virtualTourUrl', 'floorPlanUrl'],
];

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const fileId = (value) => {
  if (typeof value !== 'string' || !UUID.test(value)) throw Error('Invalid listing file.');
  return value;
};

/** Stored photos or floor plans: a name and the file IDs the review route serves. */
const files = (value) =>
  (Array.isArray(value) ? value : []).map((item) => ({
    name: typeof item?.name === 'string' ? item.name.slice(0, 120) : '',
    file: fileId(item?.file),
    thumb: item?.thumb === null || item?.thumb === undefined ? null : fileId(item.thumb),
  }));

function readOffer(value) {
  const offer = object(value);
  return {
    agreementVersion: optional(version)(offer.agreementVersion),
    expiresAt: optional(text)(offer.expiresAt),
    expired: boolean(offer.expired),
    kind: oneOf(['full', 'referral'])(offer.kind),
    feeFils: fils(offer.feeFils),
    referralShareBp: optional(bp)(offer.referralShareBp),
  };
}

function readPreviewDeal(value) {
  const deal = object(value);
  return {
    dealType: oneOf(dealTypes)(deal.dealType),
    stage: oneOf(dealStages)(deal.stage),
    earned: boolean(deal.earned),
    agreedValueFils: fils(deal.agreedValueFils),
    feeBasis: oneOf(feeBases)(deal.feeBasis),
    feeRateBp: optional(bp)(deal.feeRateBp),
    fixedFeeFils: optional(fils)(deal.fixedFeeFils),
    feeFils: fils(deal.feeFils),
    partnerShareBp: optional(bp)(deal.partnerShareBp),
    partnerName: optional(text)(deal.partnerName),
    partnerFils: optional(fils)(deal.partnerFils),
    netFils: optional(fils)(deal.netFils),
    receivedFils: total(deal.receivedFils),
    /** `0` for the Admin; `null` when earned or before finance settings exist. */
    receiverEarnsFils: optional(fils)(deal.receiverEarnsFils),
    openedDate: fact(deal.openedDate),
    targetCloseDate: fact(deal.targetCloseDate),
    milestone: fact(deal.milestone),
    nextActionDue: fact(deal.nextActionDue),
  };
}

function readProperty(value) {
  if (value === null || value === undefined) return null;
  const property = object(value);
  const keys = [...propertyFactKeys, ...listingDetailKeys];
  return {
    ...Object.fromEntries(keys.map((key) => [key, fact(property[key])])),
    photos: files(property.photos),
    floorPlans: files(property.floorPlans),
  };
}

/** `{ handover, offer, deal, client, property }`; a malformed response rejects as a whole. */
export function readHandoverPreview(body) {
  const payload = object(body);
  return {
    handover: readHandover(payload.handover),
    offer: readOffer(payload.offer),
    deal: readPreviewDeal(payload.deal),
    client: { name: text(object(payload.client).name) },
    property: readProperty(payload.property),
  };
}
