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
import { matchesRecordTab, recordTabs } from '../../records/selectors.js';
import { DeadlineList } from './DeadlineList.jsx';
import { isOverdueDeadline } from './deadlineModel.js';

const views = ['deadline', 'list'];
const module = 'Follow-ups';
const tabs = recordTabs(module);

/** Connected-only schedule presentation; scope/filtering and mutations remain the existing ones. */
export function FollowUpsPage({ toolbarExtras = null }) {
  const { t } = useI18n();
  const { user } = useSession();
  const { tab, setTab, query, setQuery, setPage } = useWorkspaceView();
  const [view, chooseView] = useRememberedChoice(
    `kws-follow-ups-view:${user.id}`,
    views,
    'deadline',
  );
  const grid = useGridColumns(module, user.id);
  const today = dubaiToday();
  const records = useRecordSearch(module, (record) =>
    tab === 'Overdue' ? isOverdueDeadline(record, today) : matchesRecordTab(module, record, tab),
  );
  const filtered = Boolean(query) || tab !== tabs[0];
  const emptyDetail = t(filtered ? 'followUps.filtered' : 'followUps.first');
  const firstPage = (apply) => (value) => {
    apply(value);
    setPage(0);
  };
  return (
    <div className="page-stack record-directory follow-ups-page">
      <RecordDirectoryHead module={module} columnNames={grid.columns} sortable={view === 'list'} />
      <GridFilterBar
        module={module}
        presetLabel={tab === tabs[0] ? t('followUps.all') : tab}
        tabs={tabs}
        tab={tab}
        onTab={firstPage(setTab)}
        query={query}
        onQuery={firstPage(setQuery)}
        tools={
          <>
            <ViewSwitch
              label={t('followUps.view')}
              options={views.map((key) => [key, t(`followUps.${key}`)])}
              value={view}
              onChange={firstPage(chooseView)}
            />
            {view === 'list' && <GridColumnChooser module={module} grid={grid} />}
          </>
        }
        extras={toolbarExtras}
      />
      {view === 'deadline' ? (
        <DeadlineList records={records} emptyDetail={emptyDetail} filtered={filtered} />
      ) : (
        <RecordTable
          module={module}
          arr={records}
          emptyDetail={emptyDetail}
          columnNames={grid.columns}
          sortInHeading
        />
      )}
    </div>
  );
}
