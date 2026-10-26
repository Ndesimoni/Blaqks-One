import React, { useId, useState } from 'react';
import { RecordTable } from '../records/RecordTable.jsx';
import { useWorkspaceView } from '../../hooks/useWorkspace.js';
import { RecordDirectoryHead } from '../records/RecordDirectoryHead.jsx';
import { usePropertyDirectory } from './usePropertyDirectory.js';
import { PropertyToolbar } from './PropertyToolbar.jsx';
import { PropertyFilters } from './PropertyFilters.jsx';
import { PropertyResults } from './PropertyResults.jsx';
import { PropertyActiveFilters } from './PropertyActiveFilters.jsx';
import './property-directory.css';

export function PropertyDirectory({ toolbarExtras = null }) {
  const directory = usePropertyDirectory();
  const { all, f, result, activeCount } = directory;
  const { viewMode } = useWorkspaceView();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filtersId = useId();
  return (
    <div className="page-stack inventory-page">
      <RecordDirectoryHead module="Properties" noun="property" />
      <PropertyToolbar
        all={all}
        f={f}
        activeCount={activeCount}
        extras={toolbarExtras}
        filtersId={filtersId}
        filtersOpen={filtersOpen}
        setFiltersOpen={setFiltersOpen}
        updateFilter={directory.updateFilter}
      />
      <PropertyFilters {...directory} expanded={filtersOpen} panelId={filtersId} />
      <PropertyActiveFilters {...directory} />
      {viewMode === 'table' ? (
        <RecordTable module="Properties" arr={result} sortInHeading />
      ) : (
        <PropertyResults {...directory} />
      )}
    </div>
  );
}
