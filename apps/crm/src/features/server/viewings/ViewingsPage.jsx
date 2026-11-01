import React from 'react';
import { ViewSwitch } from '../../../components/ui/ViewSwitch.jsx';
import { useRecordSearch } from '../../../hooks/useRecordSearch.js';
import { useRememberedChoice } from '../../../hooks/useRememberedChoice.js';
import { useSession } from '../../../hooks/useSession.js';
import { useWorkspaceView } from '../../../hooks/useWorkspace.js';
import { useI18n } from '../../../i18n/useI18n.js';
import { dubaiToday } from '../../../lib/dubaiDate.js';
import { GridColumnChooser } from '../../records/grid/GridColumnChooser.jsx';
import { GridFilterBar } from '../../records/grid/GridFilterBar.jsx';
import { useGridColumns } from '../../records/grid/useGridColumns.js';
import { RecordDirectoryHead } from '../../records/RecordDirectoryHead.jsx';
import { RecordTable } from '../../records/RecordTable.jsx';
import { recordTabs } from '../../records/selectors.js';
import { ViewingsWeek } from './ViewingsWeek.jsx';
import { matchesViewingTab } from './weekModel.js';

const views = ['week', 'list'];
const module = 'Viewings';
const tabs = recordTabs(module);

/** Connected-only calendar; all list controls, scope and record mutations keep their contracts. */
export function ViewingsPage({ toolbarExtras = null }) {
  const { t } = useI18n();
  const { user } = useSession();
  const { tab, setTab, query, setQuery, setPage } = useWorkspaceView();
  const [view, chooseView] = useRememberedChoice(`kws-viewings-view:${user.id}`, views, 'week');
  const grid = useGridColumns(module, user.id);
  const today = dubaiToday();
  const records = useRecordSearch(module, (record) => matchesViewingTab(record, tab, today));
  const filtered = Boolean(query) || tab !== tabs[0];
  const firstPage = (apply) => (value) => {
    apply(value);
    setPage(0);
  };
  return (
    <div className="page-stack record-directory viewings-page">
      <RecordDirectoryHead module={module} columnNames={grid.columns} sortable={view === 'list'} />
      <GridFilterBar
        module={module}
        presetLabel={tab === tabs[0] ? t('viewings.all') : tab}
        tabs={tabs}
        tab={tab}
        onTab={firstPage(setTab)}
        query={query}
        onQuery={firstPage(setQuery)}
        tools={
          <>
            <ViewSwitch
              label={t('viewings.view')}
              options={views.map((key) => [key, t(`viewings.${key}`)])}
              value={view}
              onChange={firstPage(chooseView)}
            />
            {view === 'list' && <GridColumnChooser module={module} grid={grid} />}
          </>
        }
        extras={toolbarExtras}
      />
      {view === 'week' ? (
        <ViewingsWeek records={records} filtered={filtered} />
      ) : (
        <RecordTable
          module={module}
          arr={records}
          emptyDetail={t(filtered ? 'viewings.filtered' : 'viewings.first')}
          columnNames={grid.columns}
          sortInHeading
        />
      )}
    </div>
  );
}
