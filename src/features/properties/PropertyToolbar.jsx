import React from 'react';
import { Icon } from '../../components/ui/Icon.jsx';
import { N } from '../../lib/format.js';
import { propertyListingTags } from '../../config/properties.js';
import { useWorkspaceView } from '../../hooks/useWorkspace.js';

export function PropertyToolbar({ result, f, activeCount, extras = null }) {
  const { query, setQuery, setPage, viewMode, setViewMode } = useWorkspaceView();
  return (
    <div className="inventory-results-bar">
      <div>
        <strong>
          {N(result.length)} {result.length === 1 ? 'property' : 'properties'}
        </strong>
        <span>
          {f.purpose === 'All'
            ? 'across your collection'
            : propertyListingTags.find((t) => t.key === f.purpose)?.label || f.purpose}
          {activeCount ? ' · refined results' : ''}
        </span>
      </div>
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
      {extras}
    </div>
  );
}
