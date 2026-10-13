import { useWorkspaceActions } from '../../hooks/useWorkspace.js';

/** The demo grants every record action; only connected mode supplies session-based grants. */
export const allowAll = () => true;

/**
 * `can(module, action)` for shared pages, where action is create, edit, delete or assign.
 * Connected actions refuse archived workspaces and anything `recordActions` does not grant.
 */
export function useRecordAccess() {
  const { can = allowAll } = useWorkspaceActions();
  return can;
}
