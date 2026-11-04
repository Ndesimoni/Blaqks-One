import React, { useMemo, useState } from 'react';
import { useSession } from '../../../hooks/useSession.js';
import { useRecords, useNavigation, useWorkspaceActions } from '../../../hooks/useWorkspace.js';
import { canOpenSection } from '../access.js';
import { useFinance } from '../finance/useFinance.js';
import {
  availableSearchTypes,
  defaultDateFilter,
  selectConnectedDateRows,
} from './dateSearchModel.js';
import { DateSearchControls } from './DateSearchControls.jsx';
import { DateSearchResults } from './DateSearchResults.jsx';
import './date-search.css';
import './date-results.css';

/**
 * Connected Date search as the approved mockup's form (design queue item 11): From, To and the
 * records to search, applied with Search, then the matching records. Scoped records plus finance
 * rows for members with finance access.
 */
export function ServerDateSearch({ owner }) {
  const { api, user } = useSession();
  const { data } = useRecords();
  const { navigate } = useNavigation();
  const { dispatchRow } = useWorkspaceActions();
  const finance = useFinance(api, owner.id, user);
  const financeAllowed = finance.access.scope !== 'none';
  const types = useMemo(
    () => availableSearchTypes({ canOpen: (m) => canOpenSection(user, m), financeAllowed }),
    [user, financeAllowed],
  );
  const [filter, setFilter] = useState(defaultDateFilter);
  const [draft, setDraft] = useState(filter);
  const { type, rows, invalidRange } = selectConnectedDateRows(
    data,
    finance.overview,
    filter,
    types,
  );
  const open = (row) =>
    type.finance ? navigate(type.module) : dispatchRow(type.module, row.record);
  return (
    <div className="page-stack connected-date-search">
      <DateSearchControls
        types={types}
        draft={draft}
        setDraft={setDraft}
        onSearch={() => setFilter(draft)}
        onClear={() => {
          const fresh = defaultDateFilter();
          setDraft(fresh);
          setFilter(fresh);
        }}
        invalidRange={invalidRange}
      />
      <DateSearchResults
        type={type}
        filter={filter}
        rows={rows}
        onOpen={open}
        finance={type?.finance ? finance : null}
        invalidRange={invalidRange}
      />
    </div>
  );
}
