import { useCallback, useEffect, useMemo, useState } from 'react';
import { readServerRecords, serverWorkspaceData } from './records.js';
import { emptyProjections, linkReference } from './projections.js';

/**
 * Connected records context: visible entries plus the read-only projections (`scope`,
 * `references`, `taskClients`, `listingViewings`). Nothing here is written to browser storage.
 */
export function useServerRecords(api, workspaceId) {
  const [entries, setEntries] = useState({});
  const [projections, setProjections] = useState(emptyProjections);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const install = useCallback(({ entries: next, ...rest }) => {
    setEntries(next);
    setProjections(rest);
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    setEntries({});
    setProjections(emptyProjections);
    setLoading(true);
    setError('');
    api
      .records(workspaceId, controller.signal)
      .then((payload) => {
        if (!controller.signal.aborted) install(readServerRecords(payload));
      })
      .catch((failure) => {
        if (failure.name !== 'AbortError') setError(failure.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [api, workspaceId, attempt, install]);
  const retry = useCallback(() => setAttempt((previous) => previous + 1), []);
  /** Quietly replaces entries and projections, e.g. after a hand-off or `entry: null`. */
  const refresh = useCallback(async () => {
    const parsed = readServerRecords(await api.records(workspaceId));
    install(parsed);
    return parsed;
  }, [api, workspaceId, install]);
  const data = useMemo(() => serverWorkspaceData(entries), [entries]);
  const referenceFor = useCallback(
    (collection, id) => linkReference(projections, collection, id),
    [projections],
  );
  return {
    entries,
    setEntries,
    data,
    ...projections,
    referenceFor,
    install,
    refresh,
    loading,
    error,
    retry,
  };
}
