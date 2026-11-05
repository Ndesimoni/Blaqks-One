import type { Choice } from './types.ts';
export const emirates: Choice[] = [
  ['abu-dhabi', 'Abu Dhabi'],
  ['dubai', 'Dubai'],
  ['sharjah', 'Sharjah'],
  ['ajman', 'Ajman'],
  ['umm-al-quwain', 'Umm Al Quwain'],
  ['ras-al-khaimah', 'Ras Al Khaimah'],
  ['fujairah', 'Fujairah'],
];
export const purposes: Choice[] = [
  ['buy', 'Buy'],
  ['rent', 'Rent'],
  ['holiday', 'Holiday homes'],
];
export const types = [
  'Apartment',
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
  'Warehouse',
  'Showroom',
  'Industrial',
  'Commercial building',
  'Residential building',
  'Plot',
  'Land',
  'Building',
  'Other',
];
export const commercialTypes = [
  'Office',
  'Retail',
  'Shop',
  'Showroom',
  'Warehouse',
  'Industrial',
  'Commercial building',
  'Plot',
  'Land',
  'Building',
];
export const categories: Choice[] = [
  ['residential', 'Residential'],
  ['commercial', 'Commercial'],
];
export const furnishings: Choice[] = [
  ['furnished', 'Furnished'],
  ['unfurnished', 'Unfurnished'],
  ['part-furnished', 'Part-furnished'],
];
export const amenities: Choice[] = [
  ['balcony', 'Balcony'],
  ['pool', 'Swimming pool'],
  ['gym', 'Gym'],
  ['parking', 'Parking'],
  ['garden', 'Private garden'],
  ['maids-room', 'Maid’s room'],
];
export const bedroomOptions: Choice[] = [
  ['studio', 'Studio'],
  ['1', '1 bedroom'],
  ['2', '2 bedrooms'],
  ['3', '3 bedrooms'],
  ['4', '4 bedrooms'],
  ['5plus', '5+ bedrooms'],
];
export const bathroomOptions: Choice[] = [
  ['1', '1+'],
  ['2', '2+'],
  ['3', '3+'],
  ['4', '4+'],
];
export const readiness: Choice[] = [
  ['ready', 'Ready'],
  ['off-plan', 'Off-plan'],
];
export const markets: Choice[] = [
  ['primary', 'Primary sale'],
  ['resale', 'Resale'],
];
export const sortOptions: Choice[] = [
  ['newest', 'Newest first'],
  ['name', 'Property name'],
  ['price-asc', 'Price: low to high'],
  ['price-desc', 'Price: high to low'],
  ['size-asc', 'Size: small to large'],
  ['size-desc', 'Size: large to small'],
];
