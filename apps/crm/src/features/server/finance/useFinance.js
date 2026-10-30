import { useCallback, useEffect, useMemo, useState } from 'react';
import { financeDeniedMessages, readFinanceAccess } from './financeAccess.js';
import { readFinanceOverview } from './financeModel.js';

/** The overview request's query: the agent filter is team-view only (§6.2). */
export const overviewQuery = (access, agent) => (access.scope === 'team' && agent ? { agent } : {});

/**
 * Connected finance overview (`GET /finance`) for the selected workspace. Members without
 * finance access never trigger a request. Parsed views stay in memory only: nothing is
 * written to browser storage, and a workspace change clears the previous workspace's data.
 */
export function useFinance(api, workspaceId, user, { agent = null } = {}) {
  const access = useMemo(() => readFinanceAccess(user), [user]);
  const allowed = access.scope !== 'none';
  const query = useMemo(() => overviewQuery(access, agent), [access, agent]);
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(allowed);
  const [error, setError] = useState(allowed ? '' : financeDeniedMessages.module);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    setOverview(null);
    if (!allowed) {
      setLoading(false);
      setError(financeDeniedMessages.module);
      return undefined;
    }
    const controller = new AbortController();
    setLoading(true);
    setError('');
    api
      .financeOverview(workspaceId, query, controller.signal)
      .then((payload) => {
        if (!controller.signal.aborted) setOverview(readFinanceOverview(payload));
      })
      .catch((failure) => {
        if (failure.name !== 'AbortError') setError(failure.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [api, workspaceId, allowed, query, attempt]);
  const retry = useCallback(() => setAttempt((previous) => previous + 1), []);
  /** Quietly reloads after a mutation; a parse or request failure keeps the last overview. */
  const refresh = useCallback(async () => {
    if (!allowed) return null;
    const parsed = readFinanceOverview(await api.financeOverview(workspaceId, query));
    setOverview(parsed);
    return parsed;
  }, [api, workspaceId, allowed, query]);
  return { access, overview, loading, error, retry, refresh };
}
