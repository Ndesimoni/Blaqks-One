import React, { useState } from 'react';
import { Button } from '../../components/ui/Button.jsx';
import { Icon } from '../../components/ui/Icon.jsx';
import { useRecordSearch } from '../../hooks/useRecordSearch.js';
import { useRecords, useWorkspaceActions, useWorkspaceView } from '../../hooks/useWorkspace.js';
import { today } from '../../lib/dates.js';
import { RecordDirectoryHead } from '../records/RecordDirectoryHead.jsx';
import { RecordTable } from '../records/RecordTable.jsx';
import { LeadSourceFilters } from './LeadSourceFilters.jsx';
import {
  leadColumns,
  leadStageOptions,
  matchesLeadFilters,
  selectLeadSources,
} from './selectors.js';

/**
 * Leads are a view over Clients (UI4a): one count, one primary action and a compact source chip
 * row replace the former summary card and "Where your leads come from" panel.
 */
export function LeadsPage({ toolbarExtras = null }) {
  const { data } = useRecords();
  const { add } = useWorkspaceActions();
  const { query, setQuery, setPage } = useWorkspaceView();
  const [source, setSource] = useState('');
  const [stage, setStage] = useState('');
  const records = useRecordSearch('Clients', (record) =>
    matchesLeadFilters(record, { source, stage }),
  );
  const sources = selectLeadSources(data.Clients);
  if (source && !sources.some((item) => item.label.toLowerCase() === source.toLowerCase())) {
    sources.push({ label: source, count: 0 });
  }
  const filtered = Boolean(source || stage || query);
  const filterSource = (value) => {
    setSource(value);
    setPage(0);
  };
  const addLead = () =>
    add('Clients', {
      lead_stage: 'New',
      date_added: today(),
      ...(source && source !== 'Not recorded' ? { lead_source: source } : {}),
    });

  return (
    <div className="page-stack leads-page">
      <RecordDirectoryHead module="Clients" noun="lead" accessModule="Leads" onAdd={addLead} />
      <div className="lead-source-bar">
        <span className="lead-source-label" aria-hidden="true">
          Source
        </span>
        <LeadSourceFilters
          sources={sources}
          selectedSource={source}
          total={data.Clients.length}
          onChange={filterSource}
        />
      </div>
      <div className="lead-filters" role="group" aria-label="Lead filters">
        <label className="lead-stage-filter">
          <span>Lead stage</span>
          <select
            value={stage}
            onChange={(event) => {
              setStage(event.target.value);
              setPage(0);
            }}
          >
            <option value="">All stages</option>
            {leadStageOptions(data.Clients, stage).map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
        <div className="search-small">
          <Icon name="search" size={16} />
          <input
            aria-label="Search leads"
            placeholder="Name, phone, email, source or campaign..."
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(0);
            }}
          />
        </div>
        <Button
          variant="light"
          disabled={!filtered}
          onClick={() => {
            setSource('');
            setStage('');
            setQuery('');
            setPage(0);
          }}
        >
          Clear filters
        </Button>
        {toolbarExtras}
      </div>
      <RecordTable
        module="Clients"
        arr={records}
        columnNames={leadColumns}
        tableLabel="Leads"
        pageLabel="Leads"
        emptyTitle="No matching leads"
        emptyDetail={
          filtered
            ? 'Clear the filters to show every lead.'
            : 'Add a lead to start tracking an enquiry.'
        }
        emptyAction={
          <Button icon="plus" onClick={addLead}>
            Add lead
          </Button>
        }
      />
    </div>
  );
}
