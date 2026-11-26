import { useCallback, useEffect, useState } from 'react';
import { useSession } from '../../../hooks/useSession.js';

/** Abort old reads when a request, conversation or workspace changes. */
export function useMarketActivity(method, id = '') {
  const { api, user } = useSession();
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState({ value: null, loading: true, error: '' });
  useEffect(() => {
    const controller = new AbortController();
    setState({ value: null, loading: true, error: '' });
    const args = id
      ? [user.workspaceId, id, controller.signal]
      : [user.workspaceId, controller.signal];
    api[method](...args)
      .then((value) => {
        if (!controller.signal.aborted) setState({ value, loading: false, error: '' });
      })
      .catch((failure) => {
        if (!controller.signal.aborted)
          setState({ value: null, loading: false, error: failure.message });
      });
    return () => controller.abort();
  }, [api, user.workspaceId, method, id, attempt]);
  const reload = useCallback(() => setAttempt((value) => value + 1), []);
  return { ...state, reload };
}
