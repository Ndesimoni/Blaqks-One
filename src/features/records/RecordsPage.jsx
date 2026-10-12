import { matchesRecordTab, recordTabs } from './selectors.js';
import { useRecordSearch } from '../../hooks/useRecordSearch.js';
import { descriptions } from '../../config/navigation.js';
import { N } from '../../lib/format.js';
import { Button } from '../../components/ui/Button.jsx';
import { Icon } from '../../components/ui/Icon.jsx';
import { RecordTable } from './RecordTable.jsx';
import React from 'react';
import { useRecords, useWorkspaceView, useWorkspaceActions } from '../../hooks/useWorkspace.js';

/** `toolbarExtras` is an optional slot (connected mode supplies the "Assigned to" filter). */
function RecordsPage({
  module,
  tabs = recordTabs(module),
  matchesTab,
  emptyDetail,
  toolbarExtras = null,
}) {
  const { data } = useRecords();
  const { tab, setTab, setPage, query, setQuery } = useWorkspaceView();
  const { add, readOnly = false } = useWorkspaceActions();

  const arr = useRecordSearch(module, (record) =>
    matchesTab ? matchesTab(record, tab) : matchesRecordTab(module, record, tab),
  );

  return (
    <div className="page-stack">
      <div className="directory-top">
        <div className="directory-count">
          <div className="large-count">{N(data[module].length)}</div>
          <div>
            <strong>Total {module.toLowerCase()}</strong>
            <p>{descriptions[module]}</p>
          </div>
        </div>
        {!readOnly && (
          <Button icon="plus" onClick={() => add(module)}>
            Add{' '}
            {{
              Clients: 'client',
              Contacts: 'contact',
              Deals: 'deal',
              'Follow-ups': 'follow-up',
              Viewings: 'viewing',
              'Client care': 'touchpoint',
              'Interaction log': 'conversation',
              Payments: 'payment',
              Expenses: 'expense',
              Shortlist: 'match',
            }[module] || 'record'}
          </Button>
        )}
      </div>
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
      <RecordTable module={module} arr={arr} emptyDetail={emptyDetail} />
    </div>
  );
}

export { RecordsPage };
