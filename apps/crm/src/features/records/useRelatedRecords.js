import { routePermissions } from '../../config/team.js';
import { useSession } from '../../hooks/useSession.js';
import { useWorkspaceActions } from '../../hooks/useWorkspace.js';

/**
 * Related-record access for details views. `canSee` follows the viewer's module grant in both
 * modes; connected data already omits records the server hides. `open` replaces the current
 * details with the related record through the same action a table row uses.
 */
export function useRelatedRecords() {
  const { user } = useSession();
  const { dispatchRow } = useWorkspaceActions();
  return {
    canSee: (module) => user?.permissions?.[routePermissions[module]] === true,
    open: (module, record) => dispatchRow?.(module, record),
  };
}
