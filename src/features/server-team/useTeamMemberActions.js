import { useRef, useState } from 'react';
import { useSession } from '../../hooks/useSession.js';

function confirmation(member, action) {
  if (action === 'cancel')
    return `Cancel ${member.name}’s invitation? Their activation link will stop working immediately.`;
  if (action === 'suspend')
    return `Suspend ${member.name}’s account? ${member.roleId === 'admin' ? 'This Admin and their staff' : 'This person'} will lose access immediately. Records will be preserved.`;
  if (action === 'restore')
    return `Restore ${member.name}’s account? They can sign in again with their existing permissions.`;
  return '';
}

export function useTeamMemberActions(workspaceId, completed) {
  const { api } = useSession();
  const [pendingId, setPendingId] = useState('');
  const [action, setAction] = useState('');
  const [error, setError] = useState('');
  const pending = useRef(false);
  const perform = async (member, kind) => {
    if (pending.current) return;
    const prompt = confirmation(member, kind);
    if (prompt && !confirm(prompt)) return;
    pending.current = true;
    setPendingId(member.id);
    setAction(kind);
    setError('');
    try {
      const result =
        kind === 'renew'
          ? await api.renewInvitation(workspaceId, member.id, member.version)
          : await api.updateMember(workspaceId, member.id, {
              version: member.version,
              active: kind === 'restore',
            });
      completed(result);
    } catch (failure) {
      setError(`${failure.message} Refresh the team before trying again.`);
    } finally {
      pending.current = false;
      setPendingId('');
      setAction('');
    }
  };
  return {
    pendingId,
    action,
    error,
    renew: (member) => perform(member, 'renew'),
    cancel: (member) => perform(member, 'cancel'),
    suspend: (member) => perform(member, 'suspend'),
    restore: (member) => perform(member, 'restore'),
  };
}
