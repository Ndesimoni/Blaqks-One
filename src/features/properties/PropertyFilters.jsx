import React from 'react';
import { useI18n } from '../../i18n/useI18n.js';

const fields = [
  ['Property type', 'type', 'Property type'],
  ['Emirate', 'emirate', 'Emirate'],
  ['Listing status', 'status', 'Listing status'],
  ['Completion', 'completion', 'Ready / off-plan'],
  ['Bedrooms', 'bedrooms', 'Bedrooms'],
];

export function PropertyFilters({
  f,
  fieldValues,
  updateFilter,
  resetFilters,
  activeCount,
  expanded,
  panelId,
}) {
  const { t } = useI18n();
  return (
    <section className="inventory-filters" aria-label="Property filters">
      <div id={panelId} hidden={!expanded}>
        <div className="inventory-filter-heading">
          <strong>{t('properties.refine')}</strong>
          <button
            type="button"
            className="inventory-reset"
            onClick={resetFilters}
            disabled={!activeCount && f.purpose === 'All'}
          >
            {t('properties.clearAll')}
          </button>
        </div>
        <div className="inventory-filter-grid">
          {fields.map(([label, key, source]) => (
            <label className="inventory-field" key={key}>
              <span>{label}</span>
              <select
                aria-label={label}
                value={f[key]}
                onChange={(event) => updateFilter(key, event.target.value)}
              >
                <option value="All">All {label.toLowerCase()}</option>
                {fieldValues(source).map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
          ))}
          <label className="inventory-field">
            <span>Maximum price / rate (AED)</span>
            <input
              aria-label="Maximum price"
              type="number"
              min="0"
              value={f.maxPrice}
              placeholder="No maximum"
              onChange={(event) => updateFilter('maxPrice', event.target.value)}
            />
          </label>
        </div>
      </div>
    </section>
  );
}
