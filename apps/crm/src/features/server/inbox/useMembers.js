import { useCallback, useEffect, useState } from 'react';
import { useI18n } from '../../../i18n/useI18n.js';

/**
 * Team members the viewer may assign conversations to. Only the Admin and whole-team staff
 * reassign (the server's rule); assigned-only staff get the Claim/Release buttons instead.
 */
export function useMembers(api, workspaceId, user) {
  const { t } = useI18n();
  const [members, setMembers] = useState([]);
  const team = user.roleId === 'admin' || user.recordScope === 'team';
  useEffect(() => {
    if (!team) return undefined;
    const controller = new AbortController();
    api
      .assignees(workspaceId, 'Clients', controller.signal)
      .then((result) => setMembers(Array.isArray(result?.assignees) ? result.assignees : []))
      .catch(() => setMembers([]));
    return () => controller.abort();
  }, [api, workspaceId, team]);
  const nameOf = useCallback(
    (id) => {
      if (!id) return '';
      if (id === user.id) return t('inbox.header.you');
      return members.find((member) => member.id === id)?.name || t('inbox.header.teamMember');
    },
    [members, user.id, t],
  );
  return { members, nameOf };
}
