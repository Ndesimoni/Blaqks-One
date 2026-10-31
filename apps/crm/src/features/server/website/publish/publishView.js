import { emirateName } from '../listings/listingsModel.js';
import { amount, emirateSlug, purposeOf } from './publishModel.js';

/** Types the server publishes without bedrooms (docs/website-backend.md). */
const COMMERCIAL = [
  'office',
  'retail',
  'shop',
  'showroom',
  'warehouse',
  'industrial',
  'commercial building',
  'plot',
  'land',
  'building',
];
const text = (record, key) => String(record?.[key] ?? '').trim();
const list = (value) =>
  (Array.isArray(value) ? value : String(value ?? '').split(/[,;|]/))
    .map((item) => String(item).trim())
    .filter(Boolean)
    .join(', ');

/**
 * The public facts as the server projects them, for the review's "What visitors will see".
 * Only allowlisted listing facts appear; unit, building, address, contacts, notes and
 * finance stay out. A studio is published as an apartment with no bedrooms.
 */
export function publicFacts(record) {
  const type = text(record, 'property_type');
  const studio = type.toLowerCase() === 'studio';
  const commercial = COMMERCIAL.includes(type.toLowerCase());
  return {
    title: text(record, 'listing_title'),
    purpose: purposeOf(record),
    type: studio ? 'Apartment' : type,
    studio,
    location: [text(record, 'community'), emirateName(emirateSlug(record?.emirate))]
      .filter(Boolean)
      .join(', '),
    bedrooms: commercial ? '' : studio ? 0 : text(record, 'bedrooms'),
    bathrooms: text(record, 'bathrooms'),
    size: amount(record, 'area_sq_ft'),
    price: amount(record, 'price_annual_rent_aed'),
    ready: text(record, 'ready_off_plan'),
    furnishing: text(record, 'furnishing'),
    description: text(record, 'property_description'),
    parking: text(record, 'parking_spaces'),
    amenities: list(record?.amenities),
    guests: purposeOf(record) === 'holiday' ? text(record, 'maximum_guests') : '',
    minimumStay: purposeOf(record) === 'holiday' ? text(record, 'minimum_stay_nights') : '',
  };
}

/** What stays private, named in the review (labels only; no private values are shown). */
export const PRIVATE_FACTS = ['unit', 'address', 'owner', 'notes', 'finance', 'files'];
