import React from 'react';
import { Icon } from '../../components/ui/Icon.jsx';
import { useWorkspaceView } from '../../hooks/useWorkspace.js';
import { PropertyPurposes } from './PropertyPurposes.jsx';
import { useI18n } from '../../i18n/useI18n.js';

export function PropertyToolbar({
  all,
  f,
  activeCount,
  extras,
  filtersId,
  filtersOpen,
  setFiltersOpen,
  updateFilter,
}) {
  const { query, setQuery, setPage, viewMode, setViewMode } = useWorkspaceView();
  const { t } = useI18n();
  return (
    <div className="property-toolbar" aria-label="Property directory controls">
      <div className="inventory-tools">
        <div className="search-small inventory-search">
          <Icon name="search" size={16} />
          <input
            aria-label="Search properties"
            placeholder="Search address, project, ID..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(0);
            }}
          />
        </div>
        <PropertyPurposes all={all} purpose={f.purpose} updateFilter={updateFilter} />
        {extras}
        <button
          type="button"
          className="property-filter-trigger"
          aria-expanded={filtersOpen}
          aria-controls={filtersId}
          onClick={() => setFiltersOpen((open) => !open)}
        >
          <Icon name="filter" size={17} />
          {t('properties.filters')}
          {activeCount ? ` (${activeCount})` : ''}
        </button>
        <div className="view-switch" role="group" aria-label="Property view mode">
          <button
            aria-label="Table view"
            aria-pressed={viewMode === 'table'}
            className={viewMode === 'table' ? 'on' : ''}
            onClick={() => setViewMode('table')}
            title="Table view"
          >
            <Icon name="menu" size={17} />
          </button>
          <button
            aria-label="Card view"
            aria-pressed={viewMode === 'cards'}
            className={viewMode === 'cards' ? 'on' : ''}
            onClick={() => setViewMode('cards')}
            title="Card view"
          >
            <Icon name="grid" size={17} />
          </button>
        </div>
      </div>
    </div>
  );
}
