import { propertyMatchesPurpose } from '../../lib/properties.js';
import { get } from '../../lib/records.js';
import { selectRecords } from '../../lib/workspace.js';

export const defaultPropertyFilters = () => ({
  purpose: 'All',
  type: 'All',
  emirate: 'All',
  status: 'All',
  completion: 'All',
  bedrooms: 'All',
  maxPrice: '',
});

export function selectProperties(
  data,
  { filters = defaultPropertyFilters(), query = '', sort } = {},
) {
  return selectRecords(data, 'Properties', {
    query,
    sort,
    filter: (property) => {
      if (!propertyMatchesPurpose(property, filters.purpose)) return false;
      for (const [key, field] of [
        ['type', 'Property type'],
        ['emirate', 'Emirate'],
        ['status', 'Listing status'],
        ['completion', 'Ready / off-plan'],
      ])
        if (filters[key] !== 'All' && get(property, field) !== filters[key]) return false;
      if (
        filters.bedrooms !== 'All' &&
        Number(get(property, 'Bedrooms')) !== Number(filters.bedrooms)
      )
        return false;
      return (
        !filters.maxPrice ||
        Number(get(property, 'Price / annual rent AED')) <= Number(filters.maxPrice)
      );
    },
  });
}

export function propertyFieldValues(properties, label) {
  return [
    ...new Set(
      properties.map((property) => String(get(property, label) || '').trim()).filter(Boolean),
    ),
  ].sort((a, b) => a.localeCompare(b));
}
