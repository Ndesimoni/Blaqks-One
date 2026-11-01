import React from 'react';
import { preferredCols } from '../../config/navigation.js';
import { useMediaQuery } from '../../hooks/useMediaQuery.js';
import { useRecords, useWorkspaceActions, useWorkspaceView } from '../../hooks/useWorkspace.js';
import { schema } from '../../lib/schema.js';
import { GridFoot } from './grid/GridFoot.jsx';
import { usePagedRecords } from './grid/usePagedRecords.js';
import { RecordCards } from './RecordCards.jsx';
import { RecordSort } from './RecordSort.jsx';
import { RecordTableEmpty } from './RecordTableEmpty.jsx';
import { RecordTableView } from './RecordTableView.jsx';
import './grid/grid-card.css';

/** Below this layout breakpoint one card per record replaces the table (UI3 §5.4). */
const cardQuery = '(max-width: 750px)';

/**
 * A directory's records in one bordered grid card (Bitrix24 list pattern, NAV): the table or
 * the phone cards, the empty state, then the footer with the total and the pager.
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
}) {
  const { data } = useRecords();
  const { setSort, sort, query } = useWorkspaceView();
  const { dispatchRow, readOnly = false } = useWorkspaceActions();
  const cards = useMediaQuery(cardQuery);

  const columns = schema(module);
  const pick = (columnNames || preferredCols[module] || [])
    .map((name) => columns.find((f) => f.name === name))
    .filter(Boolean);
  const perPage = limit ? 20 : 500;
  const { current, currentPage, setPage } = usePagedRecords(arr, perPage);
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
