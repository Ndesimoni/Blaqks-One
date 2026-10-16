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

/** Connected Date search: scoped records plus finance rows for members with finance access. */
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
        type={type}
        filter={filter}
        setFilter={setFilter}
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
