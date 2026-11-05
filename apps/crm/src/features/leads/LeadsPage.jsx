import React, { useState } from 'react';
import { Button } from '../../components/ui/Button.jsx';
import { useRecordSearch } from '../../hooks/useRecordSearch.js';
import { useRememberedChoice } from '../../hooks/useRememberedChoice.js';
import { useSession } from '../../hooks/useSession.js';
import { useRecords, useWorkspaceActions, useWorkspaceView } from '../../hooks/useWorkspace.js';
import { useI18n } from '../../i18n/useI18n.js';
import { today } from '../../lib/dates.js';
import { dubaiToday } from '../../lib/dubaiDate.js';
import { GridColumnChooser } from '../records/grid/GridColumnChooser.jsx';
import { useGridColumns } from '../records/grid/useGridColumns.js';
import { RecordDirectoryHead } from '../records/RecordDirectoryHead.jsx';
import { RecordTable } from '../records/RecordTable.jsx';
import { lookingForColumn } from './boardModel.js';
import { LeadsBoard } from './LeadsBoard.jsx';
import { LeadsToolbar } from './LeadsToolbar.jsx';
import {
  leadPresets,
  leadStageOptions,
  matchesLeadFilters,
  selectLeadSources,
} from './selectors.js';

const leadViews = ['kanban', 'list'];
const added = [lookingForColumn];

/**
 * Leads are the pipeline view over the workspace-scoped Clients collection, drawn as the
 * approved mockup's Leads screen: one filter row with its presets, then Kanban or the List.
 */
export function LeadsPage({ toolbarExtras = null, selectionActions = null }) {
  const { t } = useI18n();
  const { user } = useSession();
  const { data, scope } = useRecords();
  const actions = useWorkspaceActions();
  const canAdd = actions.can ? actions.can('Clients', 'create') : true;
  const { query, setQuery, setPage } = useWorkspaceView();
  const mine = scope === 'assigned';
  const presets = leadPresets(mine);
  const [preset, setPreset] = useState(presets[0]);
  const [source, setSource] = useState('');
  const [stage, setStage] = useState('');
  const [view, setView] = useRememberedChoice(`kws-leads-view:${user.id}`, leadViews, 'kanban');
  const grid = useGridColumns('Clients', user.id, { view: 'Leads', added });
  const now = dubaiToday();
  const records = useRecordSearch('Clients', (record) =>
    matchesLeadFilters(record, { preset, source, stage, today: now }),
  );
  const sources = selectLeadSources(data.Clients);
  if (source && !sources.some((item) => item.label.toLowerCase() === source.toLowerCase())) {
    sources.push({ label: source, count: 0 });
  }
  const filtered = Boolean(source || stage || query || preset !== presets[0]);
  const emptyDetail = filtered
    ? 'Clear the filters to show every lead.'
    : 'Add a lead to start tracking an enquiry.';
  const firstPage = (apply) => (value) => {
    apply(value);
    setPage(0);
  };
  const clearFilters = () => {
    setPreset(presets[0]);
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
  const addButton = canAdd ? (
    <Button icon="plus" onClick={addLead}>
      Add lead
    </Button>
  ) : null;
  return (
    <div className="page-stack leads-page">
      {mine && <p className="leads-scope-note">{t('leadsBoard.mine')}</p>}
      <RecordDirectoryHead module="Clients" noun="lead" columnNames={grid.columns} />
      <LeadsToolbar
        filters={{
          presets,
          preset: presets.includes(preset) ? preset : presets[0],
          onPreset: firstPage(setPreset),
          sources,
          source,
          stage,
          stages: leadStageOptions(data.Clients, stage),
          query,
          active: filtered,
          onSource: firstPage(setSource),
          onStage: firstPage(setStage),
          onQuery: firstPage(setQuery),
          onClear: clearFilters,
        }}
        view={view}
        onView={setView}
        chooser={<GridColumnChooser module="Leads" grid={grid} />}
        toolbarExtras={toolbarExtras}
      />
      {view === 'kanban' ? (
        <LeadsBoard
          records={records}
          allRecords={data.Clients}
          emptyTitle="No matching leads"
          emptyDetail={emptyDetail}
          // Filtered: the toolbar's Clear filters is the way back, so it is not repeated here.
          emptyAction={filtered ? null : addButton}
        />
      ) : (
        <RecordTable
          module="Clients"
          view="Leads"
          added={added}
          arr={records}
          columnNames={grid.columns}
          sortInHeading
          gridRows
          selectionActions={selectionActions}
          tableLabel="Leads"
          pageLabel="Leads"
          emptyTitle="No matching leads"
          emptyDetail={emptyDetail}
          emptyAction={addButton}
        />
      )}
    </div>
  );
}
