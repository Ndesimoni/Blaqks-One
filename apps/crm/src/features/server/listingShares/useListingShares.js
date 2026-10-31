import { useCallback, useEffect, useState } from 'react';
import { useSession } from '../../../hooks/useSession.js';
import { usePoll } from '../inbox/usePoll.js';
import { LISTING_SHARES_CHANGED } from '../waitingCounts.js';
import { readListingShareList, readListingShareResult } from './listingShareModel.js';

const POLL_MS = 15_000;

/**
 * One listing-share read in the caller's company: `{ value, loading, error, status, reload }`.
 * A failed refresh keeps the last value; `status` is the failure's HTTP status. Lists also
 * refresh every 15 seconds and whenever a share is sent or answered, like the badges.
 */
function useListingRead(request, read, enabled, live = false) {
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
          const status = failure.status || 0;
          setState((last) => ({ ...last, loading: false, error: failure.message, status }));
        });
    },
    [api, user.workspaceId, enabled, request, read],
  );
  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [load]);
  const reload = useCallback(() => load(), [load]);
  useEffect(() => {
    if (!enabled || !live) return undefined;
    window.addEventListener(LISTING_SHARES_CHANGED, reload);
    return () => window.removeEventListener(LISTING_SHARES_CHANGED, reload);
  }, [enabled, live, reload]);
  usePoll(reload, POLL_MS, enabled && live);
  return { ...state, reload };
}

/** The caller's incoming or sent listing shares (the Admin: the company's). */
export function useListingShareList(side) {
  const request = useCallback(
    (api, workspace, signal) => api.listingShares(workspace, side, signal),
    [side],
  );
  const read = useListingRead(request, readListingShareList, true, true);
  return { ...read, shares: read.value || [] };
}

/** The outside shares of one listing the caller sent (the Admin: the company's). */
export function useRecordListingShares(recordId) {
  const request = useCallback(
    (api, workspace, signal) => api.recordListingShares(workspace, recordId, signal),
    [recordId],
  );
  const read = useListingRead(request, readListingShareList, Boolean(recordId), true);
  return { ...read, shares: read.value || [] };
}

/** One share by its ID; the agent's first read is recorded as opened by the server. */
export function useListingShare(id) {
  const request = useCallback(
    (api, workspace, signal) => api.listingShare(workspace, id, signal),
    [id],
  );
  return useListingRead(request, readListingShareResult, Boolean(id));
}
