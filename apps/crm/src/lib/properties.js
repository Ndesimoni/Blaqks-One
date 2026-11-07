import { get } from './records.js';
import { AED } from './format.js';

const listingIntent = (p) => {
  const intent = String(get(p, 'Sale / rental') || '')
    .toLowerCase()
    .trim();
  if (/holiday|short.term|vacation|daily/.test(intent)) return 'Holiday home';
  if (/rent|lease/.test(intent)) return 'Rental';
  return 'Sale';
};

const isCommercialProperty = (p) =>
  /office|retail|shop|showroom|warehouse|industrial|commercial|factory|labour|hotel|building|land|plot/i.test(
    String(get(p, 'Property type') || ''),
  );

const priceBasis = (p) =>
  get(p, 'Price basis') ||
  (listingIntent(p) === 'Sale'
    ? 'Total price'
    : listingIntent(p) === 'Holiday home'
      ? 'Nightly'
      : 'Annual');

const propertyPrice = (p) =>
  `${AED(get(p, 'Price / annual rent AED'))}${{ Annual: ' / year', Monthly: ' / month', Weekly: ' / week', Nightly: ' / night' }[priceBasis(p)] || ''}`;

const amenityList = (r) =>
  String(get(r, 'Amenities') || '')
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);

const propertyMatchesPurpose = (p, purpose) =>
  purpose === 'All' ||
  (purpose === 'Off-plan'
    ? get(p, 'Ready / off-plan') === 'Off-plan'
    : purpose === 'Commercial'
      ? isCommercialProperty(p)
      : listingIntent(p) === purpose);

export {
  listingIntent,
  isCommercialProperty,
  priceBasis,
  propertyPrice,
  amenityList,
  propertyMatchesPurpose,
};
