import React, { useEffect, useMemo, useState } from 'react';
import { Button } from '../../../components/ui/Button.jsx';
import { Empty } from '../../../components/ui/Empty.jsx';
import { useNavigation } from '../../../hooks/useWorkspace.js';
import { N } from '../../../lib/format.js';
import { useFinanceContext } from './useFinanceRequests.js';
import {
  decidableCount,
  emptyEntryFilters,
  entryKinds,
  filterEntries,
  initialEntryFilters,
} from './entryFilters.js';
import { awaitingApproval } from './entryModel.js';
import { EntryFilters } from './EntryFilters.jsx';
import { EntryTable } from './EntryTable.jsx';
import { closedEntryDialogs, EntryDialogs } from './EntryDialogs.jsx';

/**
 * The shared Payments/Expenses list (finance-design §7): the caller's shaped rows with search,
 * a status filter, the approvers' queue, paginated rows and stacked dialogs. `view` supplies
 * the kind's heading copy, columns and card text.
 */
export function EntriesPage({ kind, view }) {
  const { overview, team, actions, readOnly } = useFinanceContext();
  const { initialQuery } = useNavigation();
  const words = entryKinds[kind];
  const rows = overview[kind];
  const [filters, setFilters] = useState(() => initialEntryFilters(initialQuery));
  const [page, setPage] = useState(0);
  const [dialog, setDialog] = useState(closedEntryDialogs);
  const [message, setMessage] = useState('');
  // A new route query (e.g. the Dashboard's queue link while this list is open) resets filters.
  const [query, setQuery] = useState(initialQuery);
  useEffect(() => {
    if (initialQuery === query) return;
    setQuery(initialQuery);
    setFilters(initialEntryFilters(initialQuery));
    setPage(0);
  }, [initialQuery, query]);
  const visible = useMemo(
    () => filterEntries(rows, filters, overview.references),
    [rows, filters, overview.references],
  );
  const waiting = useMemo(() => decidableCount(awaitingApproval(rows)), [rows]);
  const changeFilters = (next) => {
    setFilters(next);
    setPage(0);
  };
  const add = actions.can('createEntry')
    ? () => setDialog({ details: null, action: { type: 'create' } })
    : null;
  const open = (entry) => setDialog({ details: entry.id, action: null });
  const quick = (type, entry) => setDialog({ details: null, action: { type, id: entry.id } });
  return (
    <div className="page-stack finance-page">
      <div className="directory-top">
        <div className="directory-count">
          <div className="large-count">{N(rows.length)}</div>
          <div>
            <strong>{team ? view.teamHeading : view.ownHeading}</strong>
            <p>{team ? view.teamIntro : view.ownIntro}</p>
          </div>
        </div>
        {add && (
          <Button icon="plus" onClick={add}>
            {words.add}
          </Button>
        )}
      </div>
      {readOnly && (
        <p className="finance-note" role="note">
          This workspace is archived. Its {words.plural} are read-only.
        </p>
      )}
      <EntryFilters
        kind={kind}
        filters={filters}
        onChange={changeFilters}
        count={visible.length}
        waiting={waiting}
      />
      {message && (
        <p className="field-error" role="alert">
          {message}
        </p>
      )}
      {!visible.length ? (
        rows.length ? (
          <Empty
            icon="search"
            title={filters.queue ? 'Nothing is awaiting approval' : `No matching ${words.plural}`}
            detail="Try another search or clear the filters."
            action={<Button onClick={() => changeFilters(emptyEntryFilters)}>Clear filters</Button>}
          />
        ) : (
          <Empty
            icon={view.icon}
            title={`No ${words.plural} yet`}
            detail={view.empty}
            action={add && <Button onClick={add}>{words.add}</Button>}
          />
        )
      ) : (
        <EntryTable
          kind={kind}
          entries={visible}
          page={page}
          onPage={setPage}
          onOpen={open}
          onDialog={quick}
          onMessage={setMessage}
          view={view}
        />
      )}
      <EntryDialogs kind={kind} dialog={dialog} setDialog={setDialog} />
    </div>
  );
}
