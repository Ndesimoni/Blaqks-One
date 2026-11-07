import { useCallback, useEffect, useState } from 'react';
import { useSession } from '../../../hooks/useSession.js';
import { readPlatformMetrics } from './metricsModel.js';

/**
 * Blaqks One's platform figures for `period`: `{ metrics, loading, error, reload }`. The last
 * figures stay on screen while another period loads; an incomplete reply is an error.
 */
export function usePlatformMetrics(period) {
  const { api } = useSession();
  const [state, setState] = useState({ metrics: null, loading: true, error: '' });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setState((current) => ({ ...current, loading: true, error: '' }));
    api
      .platformMetrics(period, controller.signal)
      .then((value) => {
        const metrics = readPlatformMetrics(value);
        if (!controller.signal.aborted) setState({ metrics, loading: false, error: '' });
      })
      .catch((failure) => {
        if (failure.name === 'AbortError' || controller.signal.aborted) return;
        setState((current) => ({ ...current, loading: false, error: failure.message }));
      });
    return () => controller.abort();
  }, [api, period, attempt]);
  return { ...state, reload: useCallback(() => setAttempt((value) => value + 1), []) };
}
