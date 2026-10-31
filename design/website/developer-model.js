import { properties } from './data.js';
import { developers } from './developer-data.js';

export const developerStock = (id, scope = {}) =>
  properties.filter((p) => p.developer === id && (!scope.site || p.company === scope.site));

export function matchingDevelopers(query, scope) {
  const needle = (query.get('q') || '').trim().toLowerCase();
  return developers
    .filter(
      (developer) =>
        (!needle || developer.name.toLowerCase().includes(needle)) &&
        (!query.get('base') || developer.base === query.get('base')) &&
        (query.get('availability') !== 'listed' || developerStock(developer.id, scope).length > 0),
    )
    .toSorted((a, b) => a.name.localeCompare(b.name));
}

export const developerSampleNotice =
  'Developer names refer to real organisations. Listings, photography and developer associations in this preview are fictional design samples; they do not establish a partnership.';
