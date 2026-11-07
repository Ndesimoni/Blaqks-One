import type { Catalogue, Query } from './types.ts';
import { first, selectedAmenities } from './query.ts';
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
} from './options.ts';

export function filterErrors(query: Query, catalogue: Catalogue): string[] {
  const errors: string[] = [],
    get = (key: string) => first(query, key);
  for (const [min, max, label] of [
    ['minPrice', 'maxPrice', 'budget'],
    ['minSize', 'maxSize', 'size'],
  ]) {
    const low = get(min),
      high = get(max);
    for (const value of [low, high])
      if (value && (!/^\d+(\.\d{1,2})?$/.test(value) || !Number.isFinite(Number(value))))
        errors.push(`Enter a valid, non-negative ${label}.`);
    if (low && high && Number(low) > Number(high))
      errors.push(`Maximum ${label} must be at least the minimum.`);
  }
  if ((get('minPrice') || get('maxPrice') || get('sort').startsWith('price-')) && !get('purpose'))
    errors.push('Choose Buy, Rent or Holiday homes before setting a budget or sorting by price.');
  const enums = {
    purpose: purposes,
    emirate: emirates,
    category: categories,
    furnishing: furnishings,
    ready: readiness,
    market: markets,
    bedrooms: bedroomOptions,
    sort: sortOptions,
    type: types.map((v) => [v]),
  };
  for (const [key, choices] of Object.entries(enums))
    if (get(key) && !choices.some(([value]) => value === get(key)))
      errors.push(`Choose a valid ${key}.`);
  for (const key of ['bathrooms', 'parking', 'guests', 'nights'])
    if (get(key) && !/^[1-9]\d?$/.test(get(key))) errors.push(`Enter a valid ${key} value.`);
  if (get('market') && get('purpose') !== 'buy')
    errors.push('Sale market applies only to properties for sale.');
  if ((get('guests') || get('nights')) && get('purpose') !== 'holiday')
    errors.push('Guests and stay length apply only to holiday homes.');
  const area = catalogue.areas.find((a) => a.id === get('area'));
  if (get('area') && (!area || (get('emirate') && area.emirate !== get('emirate'))))
    errors.push('Choose a community in the selected emirate.');
  for (const [field, collection] of [
    ['company', catalogue.companies],
    ['agent', catalogue.agents],
    ['developer', catalogue.developers],
  ] as const)
    if (get(field) && !collection.some((entry) => entry.id === get(field)))
      errors.push(`Choose an available ${field}.`);
  if (selectedAmenities(query).some((id) => !amenities.some(([key]) => key === id)))
    errors.push('Choose an available amenity.');
  return [...new Set(errors)];
}
