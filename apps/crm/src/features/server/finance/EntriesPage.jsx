import React, { useEffect, useMemo, useState } from 'react';
import { Button } from '../../../components/ui/Button.jsx';
import { Empty } from '../../../components/ui/Empty.jsx';
import { useNavigation } from '../../../hooks/useWorkspace.js';
import { useSession } from '../../../hooks/useSession.js';
import { dubaiToday } from '../../../lib/dubaiDate.js';
import { GridColumnChooser } from '../../records/grid/GridColumnChooser.jsx';
import { GridFilterBar } from '../../records/grid/GridFilterBar.jsx';
import { useFinanceContext } from './useFinanceRequests.js';
import { decidableCount, entryKinds, filterEntries, initialEntryFilters } from './entryFilters.js';
import { entryPresets, WAITING } from './entryPresets.js';
import { awaitingApproval } from './entryModel.js';
import { EntryTable } from './EntryTable.jsx';
import { closedEntryDialogs, EntryDialogs } from './EntryDialogs.jsx';
import { useEntryColumns } from './useEntryColumns.js';

/**
 * The shared Payments/Expenses list (finance-design §7) as the mockup's grid (design step 2d):
 * the add button, the filter field with the kind's presets (the approvers' Waiting for approval
 * carries its count) and the column chooser, then the grid and stacked dialogs. `view`
 * supplies the scope line, columns and card text.
 */
export function EntriesPage({ kind, view }) {
  const { overview, team, actions, readOnly, access } = useFinanceContext();
  const { user } = useSession();
  const { initialQuery } = useNavigation();
  const words = entryKinds[kind];
  const presets = entryPresets[kind];
  const rows = overview[kind];
  const [filters, setFilters] = useState(() => initialEntryFilters(kind, initialQuery));
  const [page, setPage] = useState(0);
  const [dialog, setDialog] = useState(closedEntryDialogs);
  const [message, setMessage] = useState('');
  const columns = useEntryColumns(kind, user?.id, view.columns);
  // A new route query (e.g. the Dashboard's queue link while this list is open) resets filters.
  const [query, setQuery] = useState(initialQuery);
  useEffect(() => {
    if (initialQuery === query) return;
    setQuery(initialQuery);
    setFilters(initialEntryFilters(kind, initialQuery));
    setPage(0);
  }, [kind, initialQuery, query]);
  const today = dubaiToday();
  const visible = useMemo(
    () => filterEntries(rows, filters, overview.references, today),
    [rows, filters, overview.references, today],
  );
  const waiting = useMemo(() => decidableCount(awaitingApproval(rows)), [rows]);
  const change = (key) => (value) => {
    setFilters((current) => ({ ...current, [key]: value }));
    setPage(0);
  };
  const add = actions.can('createEntry')
    ? () => setDialog({ details: null, action: { type: 'create' } })
    : null;
  const open = (entry) => setDialog({ details: entry.id, action: null });
  const quick = (type, entry) => setDialog({ details: null, action: { type, id: entry.id } });
  const empty = rows.length ? (
    <Empty
      icon="search"
      title={
        filters.preset === WAITING ? 'Nothing is awaiting approval' : `No matching ${words.plural}`
      }
      detail="Try another search or preset, or clear them to show this month's."
    />
  ) : (
    <Empty
      icon={view.icon}
      title={`No ${words.plural} yet`}
      detail={view.empty}
      action={add && <Button onClick={add}>{words.add}</Button>}
    />
  );
  return (
    <div className="page-stack finance-page entries-page">
      {/* The mockup's page toolbar: what the list holds, and its add button on the right. */}
      <div className="entries-head">
        <p className="entries-scope">{team ? view.teamIntro : view.ownIntro}</p>
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
      <GridFilterBar
        module={words.plural}
        presetLabel={filters.preset}
        tabs={presets}
        tab={filters.preset}
        onTab={change('preset')}
        query={filters.query}
        onQuery={change('query')}
        tools={<GridColumnChooser module={kind} grid={columns.grid} />}
        counts={access.approve ? { [WAITING]: waiting } : null}
      />
      {message && (
        <p className="field-error" role="alert">
          {message}
        </p>
      )}
      <EntryTable
        kind={kind}
        entries={visible}
        page={page}
        onPage={setPage}
        onOpen={open}
        onDialog={quick}
        onMessage={setMessage}
        view={view}
        shown={columns.shown}
        empty={empty}
      />
      <EntryDialogs kind={kind} dialog={dialog} setDialog={setDialog} />
    </div>
  );
}
