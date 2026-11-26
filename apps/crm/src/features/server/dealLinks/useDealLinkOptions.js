import { useContext, useEffect, useMemo, useState } from 'react';
import { useSession } from '../../../hooks/useSession.js';
import { WorkspaceScopeContext } from '../../../app/WorkspaceScopeContext.js';
import { readFinanceAccess } from '../finance/financeAccess.js';
import { readFinanceOverview } from '../finance/financeModel.js';
import { dealLinkOptions } from './dealLinkModel.js';

/**
 * Deals the caller may link from an Interaction log, loaded from `GET /finance` only while the
 * editor is open and only for members with finance access. Nothing is stored in the browser.
 * `{ access, options, loading, error }`; without finance access no request is made.
 */
export function useDealLinkOptions() {
  const { api, user } = useSession();
  const workspaceId = useContext(WorkspaceScopeContext)?.owner?.id;
  const access = useMemo(() => readFinanceAccess(user), [user]);
  const allowed = access.scope !== 'none' && Boolean(workspaceId);
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(allowed);
  const [error, setError] = useState('');
  useEffect(() => {
    setOverview(null);
    setError('');
    if (!allowed) {
      setLoading(false);
      return undefined;
    }
    const controller = new AbortController();
    setLoading(true);
    api
      .financeOverview(workspaceId, {}, controller.signal)
      .then((payload) => {
        if (!controller.signal.aborted) setOverview(readFinanceOverview(payload));
      })
      .catch((failure) => {
        if (failure.name !== 'AbortError')
          setError('Deals could not be loaded. You can still clear the deal link.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [api, workspaceId, allowed]);
  const options = useMemo(
    () => dealLinkOptions(overview, access, user?.id),
    [overview, access, user?.id],
  );
  return { access, options, loading, error };
}
