import React from 'react';
import { GridFoot } from '../../records/grid/GridFoot.jsx';
import '../../records/grid/grid-card.css';
import { clampPage } from './dealFilters.js';
import { ENTRIES_PER_PAGE, entryCode, entryKinds } from './entryFilters.js';
import { StatusChip } from './StatusChip.jsx';
import { ApprovalActions } from './ApprovalActions.jsx';
import { EntryCards } from './EntryCards.jsx';

/** The record ID cell: a link-styled button; its click reaches the row, which opens it. */
function CodeCell({ entry }) {
  const code = entryCode(entry);
  return (
    <td>
      <button type="button" className="table-link mono id-link" aria-label={`Open ${code}`}>
        {code}
      </button>
    </td>
  );
}

/** The mockup's Approval column: the status, and the reason once a row is decided. */
function ApprovalCell({ entry }) {
  return (
    <td className="entry-status-cell">
      <StatusChip status={entry.status} />
      {entry.reason && entry.status !== 'pending' && (
        <small className="finance-sub finance-reason" title={entry.reason}>
          {entry.reason}
        </small>
      )}
    </td>
  );
}

/**
 * Paginated payments or expenses in the mockup's grid card (finance-design §7, design step
 * 2d): a table at desktop and cards at phone width, then the grid footer. `shown` are the
 * chosen `[{ label, num?, cell(entry) }]` between the ID and Approval; money is right-aligned.
 * Clicking a row opens it; decisions sit in their own right-hand column (inside each card on
 * phones) and appear only when allowed. `empty` replaces the rows when none match.
 */
export function EntryTable(props) {
  const { kind, entries, page, onPage, onOpen, onDialog, onMessage, view, shown, empty } = props;
  const current = clampPage(page, entries.length, ENTRIES_PER_PAGE);
  const rows = entries.slice(current * ENTRIES_PER_PAGE, (current + 1) * ENTRIES_PER_PAGE);
  const words = entryKinds[kind];
  const label = `${words.title}s`;
  const decide = (entry) => (
    <ApprovalActions kind={kind} entry={entry} onDialog={onDialog} onMessage={onMessage} />
  );
  return (
    <div className="grid-card finance-table-shell">
      {rows.length ? (
        <>
          <div className="table-scroll deal-table-scroll">
            <table className="data-table grid-table entry-table" aria-label={label}>
              <thead>
                <tr>
                  <th scope="col">{words.title}</th>
                  {shown.map((column) => (
                    <th key={column.label} scope="col" className={column.num ? 'finance-num' : ''}>
                      {column.label}
                    </th>
                  ))}
                  <th scope="col">Approval</th>
                  <th scope="col" className="entry-actions-head">
                    <span className="sr-only">Decisions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((entry) => (
                  <tr key={entry.id} data-status={entry.status} onClick={() => onOpen(entry)}>
                    <CodeCell entry={entry} />
                    {shown.map((column) => (
                      <td key={column.label} className={column.num ? 'finance-num' : ''}>
                        {column.cell(entry)}
                      </td>
                    ))}
                    <ApprovalCell entry={entry} />
                    <td className="entry-actions-cell" onClick={(event) => event.stopPropagation()}>
                      {decide(entry)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <EntryCards rows={rows} label={label} view={view} onOpen={onOpen} decide={decide} />
        </>
      ) : (
        empty
      )}
      <GridFoot
        total={entries.length}
        page={current}
        perPage={ENTRIES_PER_PAGE}
        label={`${label} pages`}
        onPage={onPage}
      />
    </div>
  );
}
