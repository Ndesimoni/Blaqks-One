import { useCallback, useEffect, useMemo, useState } from 'react';
import { readServerRecords, serverWorkspaceData } from './records.js';

export function useServerRecords(api, workspaceId) {
  const [entries, setEntries] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setEntries({});
    setLoading(true);
    setError('');
    api
      .records(workspaceId, controller.signal)
      .then((payload) => {
        if (!controller.signal.aborted) setEntries(readServerRecords(payload));
      })
      .catch((failure) => {
        if (failure.name !== 'AbortError') setError(failure.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [api, workspaceId, attempt]);
  const retry = useCallback(() => setAttempt((previous) => previous + 1), []);
  const data = useMemo(() => serverWorkspaceData(entries), [entries]);
  return { entries, setEntries, data, loading, error, retry };
}
