import { useContext, useState } from 'react';
import { useSession } from '../../../hooks/useSession.js';
import { useRecords, useWorkspaceView } from '../../../hooks/useWorkspace.js';
import { WorkspaceScopeContext } from '../../../app/WorkspaceScopeContext.js';
import { performBulk } from './assignmentActions.js';

/** All-or-nothing bulk reassignment for team scope (L4, M7). */
export function useBulkReassign(collection, targets) {
  const { api } = useSession();
  const { owner } = useContext(WorkspaceScopeContext);
  const records = useRecords();
  const view = useWorkspaceView();
  const [busy, setBusy] = useState(false);
  const submit = async (toId, note) => {
    if (busy || !targets.length) return {};
    setBusy(true);
    try {
      const context = { api, workspaceId: owner.id, records, view };
      return await performBulk({ ...context, collection, targets, toId, note });
    } finally {
      setBusy(false);
    }
  };
  return { busy, submit };
}
