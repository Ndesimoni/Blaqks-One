import React, { useId, useState } from 'react';
import { RecordTable } from '../records/RecordTable.jsx';
import { useSession } from '../../hooks/useSession.js';
import { useWorkspaceView } from '../../hooks/useWorkspace.js';
import { GridColumnChooser } from '../records/grid/GridColumnChooser.jsx';
import { useGridColumns } from '../records/grid/useGridColumns.js';
import { RecordDirectoryHead } from '../records/RecordDirectoryHead.jsx';
import { usePropertyDirectory } from './usePropertyDirectory.js';
import { PropertyToolbar } from './PropertyToolbar.jsx';
import { PropertyFilters } from './PropertyFilters.jsx';
import { PropertyResults } from './PropertyResults.jsx';
import { PropertyActiveFilters } from './PropertyActiveFilters.jsx';
import { detailsColumn } from './selectors.js';
import './property-directory.css';

const added = [detailsColumn];

/**
 * Properties as the approved mockup's screen: the filter row (Available, then our purposes),
 * the refine panel and its chips, then Cards or the List grid (Property, Price, Details,
 * Status; the rest in the gear).
 */
export function PropertyDirectory({ toolbarExtras = null, selectionActions = null }) {
  const directory = usePropertyDirectory();
  const { user } = useSession();
  const grid = useGridColumns('Properties', user?.id, { added });
  const { all, f, result, activeCount } = directory;
  const { viewMode } = useWorkspaceView();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filtersId = useId();
  return (
    <div className="page-stack inventory-page">
      <RecordDirectoryHead module="Properties" noun="property" columnNames={grid.columns} />
      <PropertyToolbar
        all={all}
        f={f}
        activeCount={activeCount}
        extras={toolbarExtras}
        filtersId={filtersId}
        filtersOpen={filtersOpen}
        setFiltersOpen={setFiltersOpen}
        updateFilter={directory.updateFilter}
        chooser={<GridColumnChooser module="Properties" grid={grid} />}
      />
      <PropertyFilters {...directory} expanded={filtersOpen} panelId={filtersId} />
      <PropertyActiveFilters {...directory} />
      {viewMode === 'table' ? (
        <RecordTable
          module="Properties"
          arr={result}
          columnNames={grid.columns}
          added={added}
          sortInHeading
          gridRows
          selectionActions={selectionActions}
        />
      ) : (
        <PropertyResults {...directory} />
      )}
    </div>
  );
}
