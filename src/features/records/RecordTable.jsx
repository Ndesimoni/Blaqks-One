import React, { useEffect } from 'react';
import { Pagination } from '../../components/ui/Pagination.jsx';
import { preferredCols } from '../../config/navigation.js';
import { useMediaQuery } from '../../hooks/useMediaQuery.js';
import { useRecords, useWorkspaceActions, useWorkspaceView } from '../../hooks/useWorkspace.js';
import { schema } from '../../lib/schema.js';
import { RecordCards } from './RecordCards.jsx';
import { RecordTableEmpty } from './RecordTableEmpty.jsx';
import { RecordTableView } from './RecordTableView.jsx';

/** Below this layout breakpoint one card per record replaces the table (UI3 §5.4). */
const cardQuery = '(max-width: 750px)';

function RecordTable({
  module,
  arr,
  limit = true,
  columnNames,
  tableLabel,
  pageLabel,
  emptyTitle = 'No matching records',
  emptyDetail,
  emptyAction,
}) {
  const { data } = useRecords();
  const { page, setSort, setPage, sort, query } = useWorkspaceView();
  const { dispatchRow, readOnly = false } = useWorkspaceActions();
  const cards = useMediaQuery(cardQuery);

  const columns = schema(module);
  const pick = (columnNames || preferredCols[module] || [])
    .map((name) => columns.find((f) => f.name === name))
    .filter(Boolean);
  const perPage = limit ? 12 : 500;
  const currentPage = Math.min(page, Math.max(0, Math.ceil(arr.length / perPage) - 1));
  useEffect(() => {
    if (page !== currentPage) setPage(currentPage);
  }, [page, currentPage, setPage]);
  const start = currentPage * perPage;
  const current = arr.slice(start, start + perPage);
  return (
    <div className="table-shell">
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
      <Pagination
        variant="table"
        total={arr.length}
        page={currentPage}
        pageSize={perPage}
        label={`${pageLabel || module} pages`}
        onChange={setPage}
      />
    </div>
  );
}

export { RecordTable };
