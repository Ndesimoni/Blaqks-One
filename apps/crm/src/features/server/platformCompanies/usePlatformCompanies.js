import { useCallback, useEffect, useState } from 'react';
import { useSession } from '../../../hooks/useSession.js';

/** The Super Admin's company list: `{ rows, loading, error, reload }`. */
export function usePlatformCompanies() {
  const { api } = useSession();
  const [state, setState] = useState({ rows: null, loading: true, error: '' });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setState((current) => ({ ...current, loading: true, error: '' }));
    api
      .platformCompanies(controller.signal)
      .then((value) => {
        if (!Array.isArray(value?.companies)) throw Error('The company list was incomplete.');
        if (!controller.signal.aborted)
          setState({ rows: value.companies, loading: false, error: '' });
      })
      .catch((failure) => {
        if (failure.name === 'AbortError' || controller.signal.aborted) return;
        setState((current) => ({ ...current, loading: false, error: failure.message }));
      });
    return () => controller.abort();
  }, [api, attempt]);
  return { ...state, reload: useCallback(() => setAttempt((value) => value + 1), []) };
}
