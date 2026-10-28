export const emirates = [
  ['abu-dhabi', 'Abu Dhabi'],
  ['dubai', 'Dubai'],
  ['sharjah', 'Sharjah'],
  ['ajman', 'Ajman'],
  ['umm-al-quwain', 'Umm Al Quwain'],
  ['ras-al-khaimah', 'Ras Al Khaimah'],
  ['fujairah', 'Fujairah'],
];
export const purposes = [
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
  'Office',
  'Shop',
  'Warehouse',
  'Land',
  'Building',
];
export const commercialTypes = ['Office', 'Shop', 'Warehouse', 'Land', 'Building'];
export const categories = [
  ['residential', 'Residential'],
  ['commercial', 'Commercial'],
];
export const furnishings = [
  ['furnished', 'Furnished'],
  ['unfurnished', 'Unfurnished'],
  ['part-furnished', 'Part-furnished'],
];
export const amenities = [
  ['balcony', 'Balcony'],
  ['pool', 'Swimming pool'],
  ['gym', 'Gym'],
  ['parking', 'Parking'],
  ['garden', 'Private garden'],
  ['maids-room', 'Maid’s room'],
];
export const bedroomOptions = [
  ['studio', 'Studio'],
  ['1', '1 bedroom'],
  ['2', '2 bedrooms'],
  ['3', '3 bedrooms'],
  ['4', '4 bedrooms'],
  ['5plus', '5+ bedrooms'],
];
export const bathroomOptions = [
  ['1', '1+'],
  ['2', '2+'],
  ['3', '3+'],
  ['4', '4+'],
];
export const readiness = [
  ['ready', 'Ready'],
  ['off-plan', 'Off-plan'],
];
export const markets = [
  ['primary', 'Primary sale'],
  ['resale', 'Resale'],
];
export const sortOptions = [
  ['newest', 'Newest first'],
  ['name', 'Property name'],
  ['price-asc', 'Price: low to high'],
  ['price-desc', 'Price: high to low'],
  ['size-asc', 'Size: small to large'],
  ['size-desc', 'Size: large to small'],
];
export const priceBasis = (purpose) =>
  purpose === 'rent'
    ? 'annual rent'
    : purpose === 'holiday'
      ? 'nightly rate'
      : purpose === 'buy'
        ? 'sale price'
        : 'choose a purpose';
export const bedroomLabel = (property) =>
  property.category === 'commercial'
    ? property.type
    : property.bedrooms === 0
      ? 'Studio'
      : `${property.bedrooms} ${property.bedrooms === 1 ? 'bed' : 'beds'}`;
export const optionLabel = (options, value) => options.find(([key]) => key === value)?.[1] || value;
