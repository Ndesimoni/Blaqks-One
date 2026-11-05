import { useEffect, useState } from 'react';
import { memberStatus } from '../server-team/teamDirectoryModel.js';

/**
 * The importing Admin and their company's active members, who may receive imported records
 * (BO1a); the server checks the choice again at preview and at commit.
 */
export function useImportMembers(api, user) {
  const { id, name, workspaceId } = user;
  const [members, setMembers] = useState([{ id, name: `${name} (you)` }]);
  useEffect(() => {
    const self = { id, name: `${name} (you)` };
    const controller = new AbortController();
    api
      .team(workspaceId || id, controller.signal)
      .then((result) => {
        const others = (result?.members || []).filter(
          (member) => member.id !== id && memberStatus(member) === 'active',
        );
        if (!controller.signal.aborted)
          setMembers([self, ...others.map((member) => ({ id: member.id, name: member.name }))]);
      })
      .catch(() => {});
    return () => controller.abort();
  }, [api, id, name, workspaceId]);
  return members;
}
