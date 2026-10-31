/** Synthetic records for the website publish model tests (never real data). */
export const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
export const photo = (n) => ({
  name: `p${n}.jpg`,
  file: id(n),
  thumb: id(n + 500),
  type: 'image/jpeg',
});
export const ready = {
  listing_title: 'Synthetic Marina Home',
  property_description: 'Synthetic public description',
  sale_rental: 'Sale',
  price_basis: 'Total price',
  emirate: 'Dubai',
  community: 'Dubai Marina',
  building_project: 'SYNTHETIC-TOWER',
  unit_reference: 'SYNTHETIC-UNIT-1',
  property_type: 'Apartment',
  bedrooms: '2',
  area_sq_ft: '1,200',
  price_annual_rent_aed: 2500000,
  listing_status: 'Available',
  ready_off_plan: 'Ready',
  notes: 'PRIVATE-NOTES',
  media_photos: [photo(1), photo(2)],
};
