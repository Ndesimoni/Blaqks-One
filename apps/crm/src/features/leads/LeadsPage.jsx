import React, { useState } from 'react';
import { Button } from '../../components/ui/Button.jsx';
import { useRecordSearch } from '../../hooks/useRecordSearch.js';
import { useRememberedChoice } from '../../hooks/useRememberedChoice.js';
import { useSession } from '../../hooks/useSession.js';
import { useRecords, useWorkspaceActions, useWorkspaceView } from '../../hooks/useWorkspace.js';
import { today } from '../../lib/dates.js';
import { RecordDirectoryHead } from '../records/RecordDirectoryHead.jsx';
import { RecordTable } from '../records/RecordTable.jsx';
import { LeadsBoard } from './LeadsBoard.jsx';
import { LeadsToolbar } from './LeadsToolbar.jsx';
import {
  leadColumns,
  leadStageOptions,
  matchesLeadFilters,
  selectLeadSources,
} from './selectors.js';

const leadViews = ['kanban', 'list'];

/** Leads are the pipeline view over the workspace-scoped Clients collection. */
export function LeadsPage({ toolbarExtras = null }) {
  const { user } = useSession();
  const { data } = useRecords();
  const actions = useWorkspaceActions();
  const canAdd = actions.can ? actions.can('Clients', 'create') : true;
  const { query, setQuery, setPage } = useWorkspaceView();
  const [source, setSource] = useState('');
  const [stage, setStage] = useState('');
  const [view, setView] = useRememberedChoice(`kws-leads-view:${user.id}`, leadViews, 'kanban');
  const records = useRecordSearch('Clients', (record) =>
    matchesLeadFilters(record, { source, stage }),
  );
  const sources = selectLeadSources(data.Clients);
  if (source && !sources.some((item) => item.label.toLowerCase() === source.toLowerCase())) {
    sources.push({ label: source, count: 0 });
  }
  const filtered = Boolean(source || stage || query);
  const emptyDetail = filtered
    ? 'Clear the filters to show every lead.'
    : 'Add a lead to start tracking an enquiry.';
  const filterSource = (value) => {
    setSource(value);
    setPage(0);
  };
  const clearFilters = () => {
    setSource('');
    setStage('');
    setQuery('');
    setPage(0);
  };
  const addLead = () =>
    actions.add('Clients', {
      lead_stage: 'New',
      date_added: today(),
      ...(source && source !== 'Not recorded' ? { lead_source: source } : {}),
    });

  return (
    <div className="page-stack leads-page">
      <RecordDirectoryHead module="Clients" noun="lead" columnNames={leadColumns} />
      <LeadsToolbar
        filters={{
          sources,
          source,
          total: data.Clients.length,
          stage,
          stages: leadStageOptions(data.Clients, stage),
          query,
          onSource: filterSource,
          onStage: (value) => {
            setStage(value);
            setPage(0);
          },
          onQuery: (value) => {
            setQuery(value);
            setPage(0);
          },
          onClear: clearFilters,
        }}
        view={view}
        onView={setView}
        toolbarExtras={toolbarExtras}
      />
      {view === 'kanban' ? (
        <LeadsBoard
          records={records}
          allRecords={data.Clients}
          emptyTitle="No matching leads"
          emptyDetail={emptyDetail}
          // Filtered: the toolbar's Clear filters is the way back, so it is not repeated here.
          emptyAction={
            !filtered && canAdd ? (
              <Button icon="plus" onClick={addLead}>
                Add lead
              </Button>
            ) : null
          }
        />
      ) : (
        <RecordTable
          module="Clients"
          arr={records}
          columnNames={leadColumns}
          sortInHeading
          tableLabel="Leads"
          pageLabel="Leads"
          emptyTitle="No matching leads"
          emptyDetail={emptyDetail}
          emptyAction={
            canAdd ? (
              <Button icon="plus" onClick={addLead}>
                Add lead
              </Button>
            ) : null
          }
        />
      )}
    </div>
  );
}
