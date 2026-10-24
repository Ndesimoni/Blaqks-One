/**
 * The request form's choices and the translations between the form, the server's body and the
 * draft it pre-fills (packet MK2). The budget band mirrors the server's table so the form can show
 * it while the member types; the server still decides the band it stores.
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
export const bedroomChoices = Object.freeze([0, 1, 2, 3, 4, 5, 6, 7, 8]);

const BUY = [
  ['buy_1m', 1_000_000],
  ['buy_2m', 2_000_000],
  ['buy_3m', 3_000_000],
  ['buy_5m', 5_000_000],
  ['buy_10m', 10_000_000],
  ['buy_10m_plus', Number.MAX_SAFE_INTEGER],
];
const RENT = [
  ['rent_50k', 50_000],
  ['rent_100k', 100_000],
  ['rent_150k', 150_000],
  ['rent_250k', 250_000],
  ['rent_500k', 500_000],
  ['rent_500k_plus', Number.MAX_SAFE_INTEGER],
];

/** The band a maximum budget falls in (the same edges as the server's `bands.rs`). */
export function bandFor(purpose, maximum) {
  if (!Number.isSafeInteger(maximum) || maximum <= 0) return '';
  const table = purpose === 'rent' ? RENT : BUY;
  const found = table.find(([, limit]) => maximum <= limit);
  return found ? found[0] : '';
}

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

/** The draft a client's stored requirements suggest; empty values are left for the member. */
export function draftFrom(requirements) {
  if (!requirements) return { ...emptyDraft };
  const joined = (values) => (values || []).join('\n');
  return {
    purpose: requirements.purpose || emptyDraft.purpose,
    emirate: requirements.emirate || emptyDraft.emirate,
    communities: joined(requirements.communities),
    openToOtherAreas: false,
    propertyType: requirements.propertyType || emptyDraft.propertyType,
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

const number = (value) => {
  const text = String(value ?? '').replace(/[^0-9]/g, '');
  return text ? Number(text) : null;
};

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
    moveIn: request.moveIn,
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
