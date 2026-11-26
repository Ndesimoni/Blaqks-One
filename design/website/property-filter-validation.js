import { areaBy } from './data.js';
import {
  emirates,
  purposes,
  types,
  categories,
  furnishings,
  readiness,
  markets,
  amenities,
  bedroomOptions,
  sortOptions,
} from './property-options.js';
import { developers } from './developer-data.js';

export const rangePairs = [
  ['minPrice', 'maxPrice', 'budget'],
  ['minSize', 'maxSize', 'size'],
];
export const maxPrice = (q) => q.get('maxPrice') || q.get('budget') || '';
export function filterErrors(q) {
  const errors = [];
  for (const [min, max, label] of rangePairs) {
    const lo = q.get(min),
      hi = max === 'maxPrice' ? maxPrice(q) : q.get(max);
    for (const [field, value] of [
      [min, lo],
      [max, hi],
    ])
      if (value && (!/^\d+(\.\d{1,2})?$/.test(value) || !Number.isFinite(Number(value))))
        errors.push({ field, message: `Enter a valid, non-negative ${label}.` });
    if (lo && hi && Number(lo) > Number(hi))
      errors.push({ field: max, message: `Maximum ${label} must be at least the minimum.` });
  }
  if ((q.get('minPrice') || maxPrice(q)) && !q.get('purpose'))
    errors.push({
      field: 'purpose',
      message:
        'Choose Buy, Rent or Holiday homes before a budget. Sale, annual rent and nightly prices are not comparable.',
    });
  const enums = {
    emirate: emirates,
    purpose: purposes,
    type: types.map((v) => [v]),
    category: categories,
    furnishing: furnishings,
    ready: readiness,
    market: markets,
    bedrooms: bedroomOptions,
    developer: developers.map((d) => [d.id]),
    sort: [['default', 'Newest first'], ...sortOptions],
  };
  for (const [field, options] of Object.entries(enums))
    if (q.get(field) && !options.some(([value]) => value === q.get(field)))
      errors.push({ field, message: `Choose a valid ${field}.` });
  for (const field of ['bathrooms', 'parking', 'guests', 'nights'])
    if (q.get(field) && !/^[1-9]\d?$/.test(q.get(field)))
      errors.push({ field, message: `Enter a valid ${field} value.` });
  if (
    q.get('area') &&
    (!areaBy(q.get('area')) ||
      (q.get('emirate') && areaBy(q.get('area')).emirate !== q.get('emirate')))
  )
    errors.push({ field: 'area', message: 'Choose a community in the selected emirate.' });
  if (q.get('market') && q.get('purpose') !== 'buy')
    errors.push({ field: 'market', message: 'Sale market applies only to properties for sale.' });
  if ((q.get('guests') || q.get('nights')) && q.get('purpose') !== 'holiday')
    errors.push({
      field: 'purpose',
      message: 'Guests and stay length apply only to holiday homes.',
    });
  if (/^price-/.test(q.get('sort') || '') && !q.get('purpose'))
    errors.push({ field: 'sort', message: 'Choose a purpose before sorting by price.' });
  if (
    (q.get('amenities') || '')
      .split(',')
      .filter(Boolean)
      .some((value) => !amenities.some(([key]) => key === value))
  )
    errors.push({ field: 'amenities', message: 'Choose an available amenity.' });
  return errors;
}
