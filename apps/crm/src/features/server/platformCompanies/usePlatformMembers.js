import { useCallback, useEffect, useState } from 'react';
import { useSession } from '../../../hooks/useSession.js';

/**
 * One company's people for Blaqks One (BO1a): `{ rows, error, busyId, reload, setActive }`.
 * Suspending or reactivating sends the member's version and reloads the list.
 */
export function usePlatformMembers(workspaceId) {
  const { api } = useSession();
  const [state, setState] = useState({ rows: null, error: '' });
  const [busyId, setBusyId] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    api
      .platformMembers(workspaceId, controller.signal)
      .then((value) => {
        if (!Array.isArray(value?.members)) throw Error('The member list was incomplete.');
        if (!controller.signal.aborted) setState({ rows: value.members, error: '' });
      })
      .catch((failure) => {
        if (failure.name === 'AbortError' || controller.signal.aborted) return;
        setState((current) => ({ ...current, error: failure.message }));
      });
    return () => controller.abort();
  }, [api, workspaceId, attempt]);
  const reload = useCallback(() => setAttempt((value) => value + 1), []);
  const setActive = async (member, active) => {
    setBusyId(member.id);
    try {
      await api.setPlatformMemberActive(workspaceId, member.id, {
        version: member.version,
        active,
      });
      reload();
      return true;
    } catch (failure) {
      setState((current) => ({ ...current, error: failure.message }));
      return false;
    } finally {
      setBusyId('');
    }
  };
  return { ...state, busyId, reload, setActive };
}
