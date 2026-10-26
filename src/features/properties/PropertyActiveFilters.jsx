import React from 'react';
import { propertyListingTags } from '../../config/properties.js';
import { useI18n } from '../../i18n/useI18n.js';

const labels = {
  type: 'Property type',
  emirate: 'Emirate',
  status: 'Listing status',
  completion: 'Completion',
  bedrooms: 'Bedrooms',
  maxPrice: 'Maximum price',
};

export function PropertyActiveFilters({ f, query, updateFilter, clearQuery, resetFilters }) {
  const { t } = useI18n();
  const filters = Object.entries(f).flatMap(([key, value]) => {
    if (!value || value === 'All') return [];
    const label =
      key === 'purpose'
        ? propertyListingTags.find((item) => item.key === value)?.label || value
        : `${labels[key]}: ${value}`;
    return [{ key, label }];
  });
  if (query.trim()) filters.unshift({ key: 'query', label: `Search: ${query.trim()}` });
  if (!filters.length) return null;
  return (
    <div className="property-active-filters" aria-label={t('properties.active')}>
      {filters.map(({ key, label }) => (
        <button
          type="button"
          key={key}
          aria-label={t('properties.removeFilter', { filter: label })}
          onClick={() =>
            key === 'query' ? clearQuery() : updateFilter(key, key === 'maxPrice' ? '' : 'All')
          }
        >
          {label} <span aria-hidden="true">×</span>
        </button>
      ))}
      <button type="button" className="property-clear-filters" onClick={resetFilters}>
        {t('properties.clear')}
      </button>
    </div>
  );
}
