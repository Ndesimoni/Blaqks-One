import { useCallback, useEffect, useState } from 'react';
import { useSession } from '../../../hooks/useSession.js';

/** The Blaqks One team for the Owner (BO1b): `{ rows, error, busyId, reload, setActive }`. */
export function usePlatformTeam() {
  const { api } = useSession();
  const [state, setState] = useState({ rows: null, error: '' });
  const [busyId, setBusyId] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    api
      .platformTeam(controller.signal)
      .then((value) => {
        if (!Array.isArray(value?.members)) throw Error('The team list was incomplete.');
        if (!controller.signal.aborted) setState({ rows: value.members, error: '' });
      })
      .catch((failure) => {
        if (failure.name === 'AbortError' || controller.signal.aborted) return;
        setState((current) => ({ ...current, error: failure.message }));
      });
    return () => controller.abort();
  }, [api, attempt]);
  const reload = useCallback(() => setAttempt((value) => value + 1), []);
  const setActive = async (member, active) => {
    setBusyId(member.id);
    try {
      await api.setPlatformStaffActive(member.id, { version: member.version, active });
      reload();
      return true;
    } catch (failure) {
      setState((current) => ({ ...current, error: failure.message }));
      return false;
    } finally {
      setBusyId('');
    }
  };
  /** Runs one account action for `member`, reloading on success; returns its result or null. */
  const run = async (member, call) => {
    setBusyId(member.id);
    try {
      const result = await call();
      reload();
      return result;
    } catch (failure) {
      setState((current) => ({ ...current, error: failure.message }));
      return null;
    } finally {
      setBusyId('');
    }
  };
  const signOut = (member) => run(member, () => api.signOutPlatformStaff(member.id));
  const resetPassword = (member) =>
    run(member, () => api.resetPlatformStaffPassword(member.id, { version: member.version }));
  const resend = (member) =>
    run(member, () => api.resendPlatformInvitation(member.id, { version: member.version }));
  const archive = (member) =>
    run(member, () =>
      api.archivePlatformStaff(member.id, {
        version: member.version,
        confirmationEmail: member.email,
      }),
    );
  return { ...state, busyId, reload, setActive, signOut, resetPassword, resend, archive };
}
