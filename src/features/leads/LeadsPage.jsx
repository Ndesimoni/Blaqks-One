import React, { useState } from 'react';
import { Button } from '../../components/ui/Button.jsx';
import { Icon } from '../../components/ui/Icon.jsx';
import { RecordTable } from '../records/RecordTable.jsx';
import { LeadSourceFilters } from './LeadSourceFilters.jsx';
import { useRecords, useWorkspaceActions, useWorkspaceView } from '../../hooks/useWorkspace.js';
import { useRecordSearch } from '../../hooks/useRecordSearch.js';
import { N } from '../../lib/format.js';
import { today } from '../../lib/dates.js';
import {
  leadColumns,
  leadStageOptions,
  matchesLeadFilters,
  selectLeadSources,
} from './selectors.js';

/** Leads and clients share one profile throughout the enquiry and transaction lifecycle. */
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
      <div className="directory-top">
        <div className="directory-count">
          <div className="large-count">{N(data.Clients.length)}</div>
          <div>
            <strong>Total leads</strong>
            <p>Keep contact details, sources, and enquiry progress together.</p>
          </div>
        </div>
        <Button icon="plus" onClick={addLead}>
          Add lead
        </Button>
      </div>
      <section className="panel lead-sources" aria-labelledby="lead-sources-heading">
        <div className="lead-sources-heading">
          <h2 id="lead-sources-heading">Where your leads come from</h2>
          <p>Totals across all leads. Choose a source to filter the list.</p>
        </div>
        <LeadSourceFilters
          sources={sources}
          selectedSource={source}
          total={data.Clients.length}
          onChange={filterSource}
        />
      </section>
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
          disabled={!source && !stage && !query}
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
        emptyTitle="No matching leads"
        emptyDetail="Clear the filters or add a lead to start tracking an enquiry."
        emptyAction={
          <Button icon="plus" onClick={addLead}>
            Add lead
          </Button>
        }
      />
    </div>
  );
}
