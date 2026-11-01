import React from 'react';
import { useRecordSearch } from '../../hooks/useRecordSearch.js';
import { useSession } from '../../hooks/useSession.js';
import { useWorkspaceView } from '../../hooks/useWorkspace.js';
import { useI18n } from '../../i18n/useI18n.js';
import { RecordFeed } from './feed/RecordFeed.jsx';
import { directoryNoun, plural } from './grid/directoryNouns.js';
import { GridColumnChooser } from './grid/GridColumnChooser.jsx';
import { GridFilterBar } from './grid/GridFilterBar.jsx';
import { useGridColumns } from './grid/useGridColumns.js';
import { RecordDirectoryHead } from './RecordDirectoryHead.jsx';
import { RecordTable } from './RecordTable.jsx';
import { activeTab, matchesRecordTab, recordTabs } from './selectors.js';

/** The Interaction log reads as an activity feed (NAV); the other directories are grids. */
const feedModules = new Set(['Interaction log']);

/**
 * A record directory in the Bitrix24 list pattern (NAV): count and primary action, the filter
 * bar, then the grid or feed. `toolbarExtras` is an optional slot (connected mode supplies
 * the "Assigned to" filter).
 */
function RecordsPage({
  module,
  tabs = recordTabs(module),
  matchesTab,
  emptyDetail,
  toolbarExtras = null,
}) {
  const { t } = useI18n();
  const { user } = useSession();
  const { tab: viewTab, setTab, setPage, query, setQuery } = useWorkspaceView();
  const tab = activeTab(tabs, viewTab);
  const arr = useRecordSearch(module, (record) =>
    matchesTab ? matchesTab(record, tab) : matchesRecordTab(module, record, tab),
  );
  const grid = useGridColumns(module, user?.id);
  const feed = feedModules.has(module);
  const detail = emptyDetail ?? (tab !== tabs[0] ? t('recordGrid.emptyFiltered') : undefined);
  const firstPage = (apply) => (value) => {
    apply(value);
    setPage(0);
  };
  return (
    <div className="page-stack record-directory">
      <RecordDirectoryHead module={module} columnNames={grid.columns} sortable={!feed} />
      <GridFilterBar
        module={module}
        presetLabel={
          tab === 'All' ? t('recordGrid.allPreset', { things: plural(directoryNoun(module)) }) : tab
        }
        tabs={tabs}
        tab={tab}
        onTab={firstPage(setTab)}
        query={query}
        onQuery={firstPage(setQuery)}
        tools={feed ? null : <GridColumnChooser module={module} grid={grid} />}
        extras={toolbarExtras}
      />
      {feed ? (
        <RecordFeed module={module} arr={arr} emptyDetail={detail} />
      ) : (
        <RecordTable
          module={module}
          arr={arr}
          emptyDetail={detail}
          columnNames={grid.columns}
          sortInHeading
        />
      )}
    </div>
  );
}

export { RecordsPage };
