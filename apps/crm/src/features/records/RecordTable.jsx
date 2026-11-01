import React, { useCallback } from 'react';
import { preferredCols } from '../../config/navigation.js';
import { useMediaQuery } from '../../hooks/useMediaQuery.js';
import { useRecords, useWorkspaceActions, useWorkspaceView } from '../../hooks/useWorkspace.js';
import { get } from '../../lib/records.js';
import { schema } from '../../lib/schema.js';
import { gridFields } from './grid/gridFields.js';
import { GridFoot } from './grid/GridFoot.jsx';
import { GridSelectionBar } from './grid/GridSelectionBar.jsx';
import { usePagedRecords } from './grid/usePagedRecords.js';
import { useRowSelection } from './grid/useRowSelection.js';
import { RecordCards } from './RecordCards.jsx';
import { RecordSort } from './RecordSort.jsx';
import { RecordTableEmpty } from './RecordTableEmpty.jsx';
import { RecordTableView } from './RecordTableView.jsx';
import './grid/grid-card.css';

/** Below this layout breakpoint one card per record replaces the table (UI3 §5.4). */
const cardQuery = '(max-width: 750px)';

/**
 * A directory's records in one bordered grid card (Bitrix24 list pattern, NAV): the table or
 * the phone cards, the empty state, then the footer with the total and the pager. `gridRows`
 * draws the mockup's rows; on desktop they can be ticked when the page has something to do with
 * them (Message on Clients, or the page's `selectionActions`), bringing up the selection bar.
 */
function RecordTable({
  module,
  arr,
  limit = true,
  columnNames,
  sortInHeading = false,
  tableLabel,
  pageLabel,
  emptyTitle = 'No matching records',
  emptyDetail,
  emptyAction,
  gridRows = false,
  selectionActions = null,
}) {
  const records = useRecords();
  const { data } = records;
  const { setSort, sort, query } = useWorkspaceView();
  const { dispatchRow, readOnly = false } = useWorkspaceActions();
  const cards = useMediaQuery(cardQuery);

  const columns = schema(module);
  const fields = gridFields(module, records.gridColumns?.[module]);
  const pick = (columnNames || preferredCols[module] || [])
    .map((name) => fields.find((f) => f.name === name))
    .filter(Boolean);
  const perPage = limit ? 20 : 500;
  const { current, currentPage, setPage } = usePagedRecords(arr, perPage);
  const idName = columns[0].name;
  const idOf = useCallback((record) => get(record, idName), [idName]);
  const selection = useRowSelection(arr, idOf);
  const selecting =
    gridRows && !cards && Boolean(selectionActions || (module === 'Clients' && !readOnly));
  return (
    <>
      {cards && !sortInHeading && (
        <div className="record-sort-fallback">
          <RecordSort module={module} columnNames={columnNames} />
        </div>
      )}
      <div className="grid-card">
        {cards ? (
          <RecordCards
            module={module}
            data={data}
            current={current}
            pick={pick}
            identity={columns[0]}
            readOnly={readOnly}
            onOpen={(record) => dispatchRow(module, record)}
          />
        ) : (
          <RecordTableView
            module={module}
            data={data}
            current={current}
            pick={pick}
            columns={columns}
            sort={sort}
            setSort={setSort}
            setPage={setPage}
            dispatchRow={dispatchRow}
            readOnly={readOnly}
            tableLabel={tableLabel}
            gridRows={gridRows}
            selection={selecting ? selection : null}
          />
        )}
        {!arr.length && (
          <RecordTableEmpty
            module={module}
            title={emptyTitle}
            detail={emptyDetail}
            action={emptyAction}
            query={query}
            readOnly={readOnly}
          />
        )}
        {selecting && (
          <GridSelectionBar module={module} selection={selection} actions={selectionActions} />
        )}
        <GridFoot
          total={arr.length}
          page={currentPage}
          perPage={perPage}
          label={`${pageLabel || module} pages`}
          onPage={setPage}
        />
      </div>
    </>
  );
}

export { RecordTable };
