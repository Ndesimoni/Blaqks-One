import { useCallback, useEffect, useState } from 'react';
import { readAgreementList } from '../server/finance/settingsModel.js';

/**
 * The team's commission agreements (`GET /finance/agreements`, team finance only, §14.4).
 * Parsed rows stay in memory only, never in browser storage.
 */
export function useAgreements(api, workspaceId, allowed) {
  const [agreements, setAgreements] = useState([]);
  const [loading, setLoading] = useState(allowed);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  // A workspace change clears the list; a reload keeps it visible until the new one arrives.
  useEffect(() => setAgreements([]), [workspaceId]);
  useEffect(() => {
    if (!allowed) {
      setAgreements([]);
      setLoading(false);
      return undefined;
    }
    const controller = new AbortController();
    setLoading(true);
    setError('');
    api
      .financeAgreements(workspaceId, null, controller.signal)
      .then((body) => {
        if (!controller.signal.aborted) setAgreements(readAgreementList(body));
      })
      .catch((failure) => {
        if (failure.name !== 'AbortError' && !controller.signal.aborted) setError(failure.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [api, workspaceId, allowed, attempt]);
  const reload = useCallback(() => setAttempt((value) => value + 1), []);
  return { agreements, loading, error, reload };
}
