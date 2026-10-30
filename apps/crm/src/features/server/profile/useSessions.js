import { useCallback, useEffect, useState } from 'react';

/** Loads the caller's own sessions and runs sign-outs, reporting results politely. */
export function useSessions(api) {
  const [sessions, setSessions] = useState(null);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setError('');
    api
      .sessions(controller.signal)
      .then((result) => {
        if (!Array.isArray(result)) throw Error('Your sessions could not be loaded. Try again.');
        if (!controller.signal.aborted) setSessions(result);
      })
      .catch((failure) => {
        if (failure.name !== 'AbortError') setError(failure.message);
      });
    return () => controller.abort();
  }, [api, attempt]);
  const reload = useCallback(() => setAttempt((value) => value + 1), []);
  const run = useCallback(
    async (action, success) => {
      setBusy(true);
      setError('');
      setStatus('');
      try {
        const result = await action();
        setStatus(success(result));
      } catch (failure) {
        setError(failure.message);
      } finally {
        setBusy(false);
        reload();
      }
    },
    [reload],
  );
  const revoke = (id) =>
    run(
      () => api.revokeSession(id),
      () => 'That device was signed out.',
    );
  const revokeOthers = () =>
    run(api.revokeOtherSessions, ({ revoked }) =>
      revoked === 1
        ? '1 other device was signed out.'
        : `${revoked || 0} other devices were signed out.`,
    );
  return { sessions, error, status, busy, reload, revoke, revokeOthers };
}
