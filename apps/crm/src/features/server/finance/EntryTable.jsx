import React from 'react';
import { Pagination } from '../../../components/ui/Pagination.jsx';
import { clampPage } from './dealFilters.js';
import { ENTRIES_PER_PAGE, entryCode, entryKinds } from './entryFilters.js';
import { StatusChip } from './StatusChip.jsx';
import { ApprovalActions } from './ApprovalActions.jsx';
import { EntryCards } from './EntryCards.jsx';

/** The record ID cell: a link-styled button that opens the row's details. */
function CodeCell({ entry, date, onOpen }) {
  const code = entryCode(entry);
  return (
    <td>
      <button
        type="button"
        className="table-link mono id-link"
        aria-label={`Open ${code}`}
        onClick={() => onOpen(entry)}
      >
        {code}
      </button>
      <small className="finance-sub">{date(entry)}</small>
    </td>
  );
}

/**
 * Paginated payments or expenses (finance-design §7): a table at desktop and cards at phone
 * width. `columns` are `[{ label, num?, cell(entry) }]` between the ID and the status; money
 * is right-aligned and status is always text. Decisions sit in their own right-hand column
 * (inside each card on phones) and appear only when allowed.
 */
export function EntryTable({ kind, entries, page, onPage, onOpen, onDialog, onMessage, view }) {
  const current = clampPage(page, entries.length, ENTRIES_PER_PAGE);
  const rows = entries.slice(current * ENTRIES_PER_PAGE, (current + 1) * ENTRIES_PER_PAGE);
  const words = entryKinds[kind];
  const label = `${words.title}s`;
  const decide = (entry) => (
    <ApprovalActions kind={kind} entry={entry} onDialog={onDialog} onMessage={onMessage} />
  );
  return (
    <div className="table-shell finance-table-shell">
      <div className="table-scroll deal-table-scroll">
        <table className="data-table entry-table" aria-label={label}>
          <thead>
            <tr>
              <th scope="col">{words.title}</th>
              {view.columns.map((column) => (
                <th key={column.label} scope="col" className={column.num ? 'finance-num' : ''}>
                  {column.label}
                </th>
              ))}
              <th scope="col">Status</th>
              <th scope="col" className="entry-actions-head">
                <span className="sr-only">Decisions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((entry) => (
              <tr key={entry.id} data-status={entry.status}>
                <CodeCell entry={entry} date={view.date} onOpen={onOpen} />
                {view.columns.map((column) => (
                  <td key={column.label} className={column.num ? 'finance-num' : ''}>
                    {column.cell(entry)}
                  </td>
                ))}
                <td className="entry-status-cell">
                  <StatusChip status={entry.status} />
                  {entry.reason && entry.status !== 'pending' && (
                    <small className="finance-sub finance-reason" title={entry.reason}>
                      {entry.reason}
                    </small>
                  )}
                </td>
                <td className="entry-actions-cell">{decide(entry)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <EntryCards rows={rows} label={label} view={view} onOpen={onOpen} decide={decide} />
      <Pagination
        variant="table"
        total={entries.length}
        page={current}
        pageSize={ENTRIES_PER_PAGE}
        itemLabel={words.plural}
        label={`${label} pages`}
        onChange={onPage}
      />
    </div>
  );
}
