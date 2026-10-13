import React from 'react';
import { Button } from '../../components/ui/Button.jsx';
import { N } from '../../lib/format.js';
import { RecordTable } from '../records/RecordTable.jsx';
import { useWorkspaceView, useWorkspaceActions } from '../../hooks/useWorkspace.js';
import { useRecordAccess } from '../records/useRecordAccess.js';
import { usePropertyDirectory } from './usePropertyDirectory.js';
import { PropertyPurposes } from './PropertyPurposes.jsx';
import { PropertyToolbar } from './PropertyToolbar.jsx';
import { PropertyFilters } from './PropertyFilters.jsx';
import { PropertyResults } from './PropertyResults.jsx';

export function PropertyDirectory({ toolbarExtras = null }) {
  const directory = usePropertyDirectory();
  const { all, f, result, activeCount } = directory;
  const { viewMode } = useWorkspaceView();
  const { add } = useWorkspaceActions();
  const can = useRecordAccess();
  return (
    <div className="page-stack inventory-page">
      <section className="directory-top" aria-label="Portfolio summary">
        <div className="directory-count">
          <div className="large-count">{N(all.length)}</div>
          <div>
            <strong>Total properties</strong>
            <p>Manage your listings and availability.</p>
          </div>
        </div>
        {can('Properties', 'create') && (
          <Button icon="plus" onClick={() => add('Properties')}>
            Add property
          </Button>
        )}
      </section>
      <PropertyPurposes all={all} purpose={f.purpose} updateFilter={directory.updateFilter} />
      <PropertyToolbar result={result} f={f} activeCount={activeCount} extras={toolbarExtras} />
      <PropertyFilters {...directory} />
      {viewMode === 'table' ? (
        <RecordTable module="Properties" arr={result} />
      ) : (
        <PropertyResults {...directory} />
      )}
    </div>
  );
}
