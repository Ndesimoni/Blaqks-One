import React from 'react';
import { Empty } from '../../components/ui/Empty.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { useRecords, useWorkspaceActions } from '../../hooks/useWorkspace.js';
import { useRecordAccess } from './useRecordAccess.js';

export const awaitingAssignmentText = 'Records assigned to you will appear here.';

function emptyText({ awaiting, detail, query, readOnly, canCreate }) {
  if (awaiting) return awaitingAssignmentText;
  if (detail) return detail;
  if (query) return 'Try another search or clear filters.';
  if (readOnly) return 'No records were saved in this archived workspace.';
  return canCreate
    ? 'Use Add record to start building your workspace.'
    : 'No records have been added yet.';
}

/** Empty table state; Add appears only when the member may create records in the module. */
export function RecordTableEmpty({ module, title, detail, action, query, readOnly }) {
  const { add } = useWorkspaceActions();
  const { data, scope } = useRecords();
  const canCreate = useRecordAccess()(module, 'create');
  // Assigned-only staff see records once they are assigned (connected projection scope).
  const awaiting = scope === 'assigned' && !query && !data[module]?.length;
  return (
    <Empty
      title={title}
      detail={emptyText({ awaiting, detail, query, readOnly, canCreate })}
      action={
        canCreate
          ? (action ?? (
              <Button icon="plus" onClick={() => add(module)}>
                Add record
              </Button>
            ))
          : undefined
      }
    />
  );
}
