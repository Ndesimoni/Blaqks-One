import { useContext, useState } from 'react';
import { useSession } from '../../../hooks/useSession.js';
import { useRecords, useWorkspaceActions, useWorkspaceView } from '../../../hooks/useWorkspace.js';
import { WorkspaceScopeContext } from '../../../app/WorkspaceScopeContext.js';
import {
  canReassign,
  effectiveHolder,
  findEntry,
  inheritedVisibility,
  isAssignable,
  losesVisibility,
  returnsOnly,
} from './assignmentModel.js';
import { performAssignment } from './assignmentActions.js';

/** One record's holder, permissions and hand-off (PUT assignee, L5 re-fetch and 404 removal). */
export function useAssignment(module, record) {
  const { api, user } = useSession();
  const { owner } = useContext(WorkspaceScopeContext);
  const records = useRecords();
  const view = useWorkspaceView();
  const { readOnly = false, can } = useWorkspaceActions();
  const [busy, setBusy] = useState(false);
  const me = user?.id;
  const entry = findEntry(records.entries, module, record);
  const holder = effectiveHolder(records.entries, module, entry);
  const inherited = inheritedVisibility(records.entries, module, record, me);
  const returnOnly = returnsOnly(records.entries, module, entry, records.scope, me);
  // Contract §12 M-A: returning a client-linked Follow-up needs no Hand on grant.
  const canAssign = Boolean(can?.(module, 'assign'));
  const assign = async (toId, note) => {
    if (busy || !entry) return {};
    setBusy(true);
    try {
      const context = { api, workspaceId: owner.id, records, view };
      return await performAssignment({ ...context, module, entry, toId, note, returnOnly });
    } finally {
      setBusy(false);
    }
  };
  return {
    me,
    entry,
    holder,
    scope: records.scope,
    busy,
    canAssign,
    canReassign:
      !readOnly &&
      Boolean(entry) &&
      isAssignable(module) &&
      canReassign(records.scope, holder, me) &&
      (canAssign || returnOnly),
    canQueue: records.scope === 'team',
    returnOnly,
    willLose: (toId) => losesVisibility({ scope: records.scope, me, toId, inherited }),
    assign,
  };
}
