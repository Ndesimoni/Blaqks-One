import { propertyListingTags } from '../../config/properties.js';
import { N } from '../../lib/format.js';
import { propertyMatchesPurpose } from '../../lib/properties.js';
import { get } from '../../lib/records.js';
import { selectRecords } from '../../lib/workspace.js';

/**
 * The approved mockup's Available preset (a listing status) beside our listing purposes with
 * their counts. All listings stays the default: Listing status is optional, so opening on
 * Available would hide listings without one after every reload.
 */
export const AVAILABLE = 'Available';
export const propertyPresets = [
  { key: 'All', label: 'All listings' },
  { key: AVAILABLE, label: 'Available' },
  ...propertyListingTags.filter((tag) => tag.key !== 'All'),
];

export const matchesPropertyPreset = (property, preset) =>
  preset === AVAILABLE
    ? get(property, 'Listing status') === AVAILABLE
    : propertyMatchesPurpose(property, preset);

/** The mockup's Details column: "2 bed · 1,240 sq ft · Dubai Marina", display only. */
export const detailsColumn = Object.freeze({
  key: 'details',
  name: 'Details',
  virtual: true,
  value: (property) => {
    const bedrooms = get(property, 'Bedrooms');
    const area = get(property, 'Area sq ft');
    return [
      bedrooms !== undefined && bedrooms !== '' && `${bedrooms} bed`,
      area && `${N(area)} sq ft`,
      get(property, 'Community'),
    ]
      .filter(Boolean)
      .join(' · ');
  },
});

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
      if (!matchesPropertyPreset(property, filters.purpose)) return false;
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
