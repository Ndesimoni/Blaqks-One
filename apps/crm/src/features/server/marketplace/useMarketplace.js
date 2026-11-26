import { useCallback, useEffect, useState } from 'react';
import { useSession } from '../../../hooks/useSession.js';
import { readMarketplaceApplications, readMarketplaceStatus } from './marketplaceModel.js';
import { readTerms } from './marketplaceProfileModel.js';

/**
 * One marketplace read: `{ value, loading, error, status, reload }`. A failed refresh keeps
 * the last value, so a temporary error never blanks the screen.
 */
function useMarketplaceRead(request, read, enabled = true) {
  const { api, user } = useSession();
  const [state, setState] = useState({ value: null, loading: enabled, error: '', status: 0 });
  const load = useCallback(
    (signal) => {
      if (!enabled) return Promise.resolve();
      return request(api, user.workspaceId, signal)
        .then((value) => {
          if (!signal?.aborted)
            setState({ value: read(value), loading: false, error: '', status: 0 });
        })
        .catch((failure) => {
          if (failure.name === 'AbortError' || signal?.aborted) return;
          setState((last) => ({
            ...last,
            loading: false,
            error: failure.message,
            status: failure.status || 0,
          }));
        });
    },
    [api, user.workspaceId, enabled, request, read],
  );
  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [load]);
  return { ...state, reload: useCallback(() => load(), [load]) };
}

/** The caller's company state, switch and checklist. */
export function useMarketplaceStatus(enabled = true) {
  const request = useCallback(
    (api, workspace, signal) => api.marketplaceStatus(workspace, signal),
    [],
  );
  return useMarketplaceRead(request, readMarketplaceStatus, enabled);
}

/** The Super Admin's application queue, pending first. */
export function useMarketplaceApplications() {
  const request = useCallback(
    (api, workspace, signal) => api.marketplaceApplications(workspace, 'all', signal),
    [],
  );
  return useMarketplaceRead(request, readMarketplaceApplications);
}

/** One terms version in full, fetched once the status names the current version. */
export function useMarketplaceTerms(version) {
  const request = useCallback(
    (api, workspace, signal) => api.marketplaceTerms(workspace, version, signal),
    [version],
  );
  return useMarketplaceRead(request, readTerms, Boolean(version));
}
