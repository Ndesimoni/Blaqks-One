import React from 'react';
import { Icon } from '../../components/ui/Icon.jsx';
import { useRecordSearch } from '../../hooks/useRecordSearch.js';
import { useWorkspaceView } from '../../hooks/useWorkspace.js';
import { RecordDirectoryHead } from './RecordDirectoryHead.jsx';
import { RecordTable } from './RecordTable.jsx';
import { matchesRecordTab, recordTabs } from './selectors.js';

/**
 * Desktop columns for the Clients pilot: identity, requirement, stage, budget, quality and next
 * follow-up fit beside the action cell at 1280, so nothing is clipped (UI3 §5.4, B-01).
 */
const pilotColumns = {
  Clients: [
    'Client ID',
    'Full name',
    'Lead stage',
    'Buy / rent',
    'Maximum budget AED',
    'Lead quality score / 100',
    'Next follow-up auto',
  ],
};

/** `toolbarExtras` is an optional slot (connected mode supplies the "Assigned to" filter). */
function RecordsPage({
  module,
  tabs = recordTabs(module),
  matchesTab,
  emptyDetail,
  toolbarExtras = null,
}) {
  const { tab, setTab, setPage, query, setQuery } = useWorkspaceView();
  const arr = useRecordSearch(module, (record) =>
    matchesTab ? matchesTab(record, tab) : matchesRecordTab(module, record, tab),
  );

  return (
    <div className="page-stack record-directory">
      <RecordDirectoryHead module={module} />
      <div className="filters-toolbar">
        <div className="tabs" role="group" aria-label={`Filter ${module}`}>
          {tabs.map((t) => (
            <button
              key={t}
              aria-pressed={t === tab}
              className={t === tab ? 'active' : ''}
              onClick={() => {
                setTab(t);
                setPage(0);
              }}
            >
              {t}
            </button>
          ))}
        </div>
        <div className="filter-right">
          <div className="search-small">
            <Icon name="search" size={16} />
            <input
              aria-label={'Search ' + module}
              placeholder="Search records..."
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(0);
              }}
            />
          </div>
        </div>
        {toolbarExtras}
      </div>
      <RecordTable
        module={module}
        arr={arr}
        emptyDetail={emptyDetail}
        columnNames={pilotColumns[module]}
      />
    </div>
  );
}

export { RecordsPage };
