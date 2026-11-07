import { wholeDirhams } from './requestBands.js';

/**
 * The request form's choices and the translations between the form, the server's body and the
 * draft it pre-fills (packet MK2).
 */
export const propertyTypes = Object.freeze([
  'Apartment',
  'Studio',
  'Villa',
  'Townhouse',
  'Penthouse',
  'Duplex',
  'Loft',
  'Serviced apartment',
  'Hotel apartment',
  'Office',
  'Retail',
  'Shop',
  'Showroom',
  'Warehouse',
  'Industrial',
  'Commercial building',
  'Residential building',
  'Plot',
  'Land',
  'Other',
]);
/** 0 is a studio; the server accepts up to 20, so a client's stored count always has a choice. */
export const bedroomChoices = Object.freeze(Array.from({ length: 21 }, (_, count) => count));

export const emptyDraft = Object.freeze({
  purpose: 'rent',
  emirate: 'dubai',
  communities: '',
  openToOtherAreas: false,
  propertyType: 'Apartment',
  bedrooms: '',
  budgetMinAed: '',
  budgetMaxAed: '',
  ready: 'any',
  furnishing: 'any',
  cheques: '',
  buildingAge: 'any',
  moveIn: '',
});

/** A stored property type as one of the form's choices (any casing), or the default. */
const knownType = (stored) =>
  propertyTypes.find(
    (name) =>
      name.toLowerCase() ===
      String(stored || '')
        .trim()
        .toLowerCase(),
  ) || emptyDraft.propertyType;

/** The draft a client's stored requirements suggest; empty values are left for the member. */
export function draftFrom(requirements) {
  if (!requirements) return { ...emptyDraft };
  const joined = (values) => (values || []).join('\n');
  return {
    purpose: requirements.purpose || emptyDraft.purpose,
    emirate: requirements.emirate || emptyDraft.emirate,
    communities: joined(requirements.communities),
    openToOtherAreas: false,
    propertyType: knownType(requirements.propertyType),
    bedrooms: requirements.bedrooms === null ? '' : String(requirements.bedrooms),
    budgetMinAed: requirements.budgetMinAed === null ? '' : String(requirements.budgetMinAed),
    budgetMaxAed: requirements.budgetMaxAed === null ? '' : String(requirements.budgetMaxAed),
    ready: 'any',
    furnishing: 'any',
    cheques: '',
    buildingAge: 'any',
    moveIn: requirements.moveIn || '',
  };
}

const number = wholeDirhams;

/** A stored request back in the form, for an edit. */
export function draftFromRequest(request) {
  return {
    purpose: request.purpose,
    emirate: request.emirate,
    communities: request.communities.join('\n'),
    openToOtherAreas: request.openToOtherAreas,
    propertyType: request.propertyType,
    bedrooms: request.bedrooms === null ? '' : String(request.bedrooms),
    budgetMinAed: request.budgetMinAed === null ? '' : String(request.budgetMinAed),
    budgetMaxAed: request.budgetMaxAed === null ? '' : String(request.budgetMaxAed),
    ready: request.ready,
    furnishing: request.furnishing,
    cheques: request.cheques === null ? '' : String(request.cheques),
    buildingAge: request.buildingAge,
    moveIn: request.moveIn || '',
  };
}

/** What the form sends: numbers as numbers, a month or null, rent-only cheques. */
export function requestBodyOf(draft) {
  return {
    purpose: draft.purpose,
    emirate: draft.emirate,
    communities: draft.communities
      .split('\n')
      .map((name) => name.trim())
      .filter(Boolean),
    openToOtherAreas: Boolean(draft.openToOtherAreas),
    propertyType: draft.propertyType,
    bedrooms: draft.bedrooms === '' ? null : Number(draft.bedrooms),
    budgetMinAed: number(draft.budgetMinAed),
    budgetMaxAed: number(draft.budgetMaxAed) ?? 0,
    ready: draft.ready,
    furnishing: draft.furnishing,
    cheques: draft.purpose === 'rent' && draft.cheques !== '' ? Number(draft.cheques) : null,
    buildingAge: draft.buildingAge,
    moveIn: draft.moveIn ? draft.moveIn : null,
  };
}

/** The first problem with the draft, as a message key, or an empty string. */
export function problemOf(draft) {
  const maximum = number(draft.budgetMaxAed);
  const minimum = number(draft.budgetMinAed);
  if (!draft.purpose || !draft.emirate || !draft.propertyType) return 'required';
  if (!maximum || maximum <= 0) return 'budget';
  if (minimum !== null && minimum > maximum) return 'budget';
  if (draft.moveIn && !/^\d{4}-(0[1-9]|1[0-2])$/.test(draft.moveIn)) return 'required';
  return '';
}
