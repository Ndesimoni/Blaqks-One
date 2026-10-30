import React, { useMemo, useState } from 'react';
import { RecordsContext } from '../../../app/WorkspaceContext.js';
import { useSession } from '../../../hooks/useSession.js';
import { useRecords, useWorkspaceActions, useWorkspaceView } from '../../../hooks/useWorkspace.js';
import { filterAssignedEntries, isAssignable } from './assignmentModel.js';
import { withKept } from '../keptRecords.js';
import { useAssignees } from './useAssignees.js';
import { AssignedToFilter } from './AssignedToFilter.jsx';
import { BulkReassignDialog } from './BulkReassignDialog.jsx';
import './assignment.css';
import './assigned-filter.css';

/**
 * Wraps one connected record page. For team scope it narrows that page's collection by holder
 * and hands the page an "Assigned to" toolbar slot. Dialogs outside keep the full records.
 */
export function AssignmentPageScope({ module, children }) {
  const records = useRecords();
  const { user } = useSession();
  const { setPage } = useWorkspaceView();
  const { readOnly = false, can } = useWorkspaceActions();
  // Bulk moves need team scope and the Hand on grant (contract §4, §12 M-B).
  const canBulk = !readOnly && Boolean(can?.(module, 'assign'));
  const enabled = records.scope === 'team' && isAssignable(module);
  const assignees = useAssignees(module, enabled);
  const [filter, setFilter] = useState('');
  const [bulkOpen, setBulkOpen] = useState(false);
  const active = enabled && Boolean(filter);
  const rows = useMemo(
    () => (active ? filterAssignedEntries(records.entries, module, filter) : null),
    [active, records.entries, module, filter],
  );
  // Handed-over clients and listings the caller keeps reading (§18), and the clients,
  // listings and contacts colleagues shared with them (record sharing R1), show on their pages.
  const kept = records.keptEntries?.[module];
  const scoped = useMemo(() => {
    if (rows) return { ...records, data: { ...records.data, [module]: rows.map((r) => r.record) } };
    if (!kept?.length) return records;
    const entries = withKept(records.entries, records.keptEntries, [module]);
    const data = { ...records.data, [module]: entries[module].map((entry) => entry.record) };
    return { ...records, entries, data };
  }, [records, rows, module, kept]);
  const toolbar = enabled ? (
    <AssignedToFilter
      module={module}
      filter={filter}
      onChange={(value) => {
        setFilter(value);
        setPage(0);
      }}
      assignees={assignees}
      me={user?.id}
      count={rows?.length ?? 0}
      onBulk={canBulk ? () => setBulkOpen(true) : undefined}
    />
  ) : null;
  return (
    <RecordsContext.Provider value={scoped}>
      {children(toolbar)}
      {bulkOpen && active && canBulk && (
        <BulkReassignDialog
          module={module}
          filter={filter}
          assignees={assignees}
          me={user?.id}
          onClose={() => setBulkOpen(false)}
        />
      )}
    </RecordsContext.Provider>
  );
}
