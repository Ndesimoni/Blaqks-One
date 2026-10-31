import { useCallback, useContext, useEffect, useState } from 'react';
import { WorkspaceScopeContext } from '../../../app/WorkspaceScopeContext.js';
import { useSession } from '../../../hooks/useSession.js';
import { usePoll } from '../inbox/usePoll.js';
import { SHARES_CHANGED } from '../waitingCounts.js';
import { readCandidates, readShareList, readShareResult } from './shareModel.js';

const POLL_MS = 15_000;

/**
 * One share read in the selected workspace: `{ value, loading, error, status, reload }`.
 * `request` gets the API, the workspace and an abort signal; `read` checks the response
 * strictly. A failed refresh keeps the last value; `status` is the failure's HTTP status.
 */
function useShareRead(request, read, enabled) {
  const { api } = useSession();
  const { owner } = useContext(WorkspaceScopeContext);
  const [state, setState] = useState({ value: null, loading: enabled, error: '', status: 0 });
  const load = useCallback(
    (signal) => {
      if (!enabled) return Promise.resolve();
      return request(api, owner.id, signal)
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
    [api, owner.id, enabled, request, read],
  );
  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [load]);
  const reload = useCallback(() => load(), [load]);
  return { ...state, reload };
}

const listShares = (api, workspace, signal) => api.shares(workspace, signal);

/**
 * The caller's shares (`{ incoming, outgoing }`), refreshed every 15 seconds while the page
 * is visible and whenever a share is sent or answered, like the sidebar badges.
 */
export function useShareList(enabled) {
  const read = useShareRead(listShares, readShareList, enabled);
  const { reload } = read;
  useEffect(() => {
    if (!enabled) return undefined;
    window.addEventListener(SHARES_CHANGED, reload);
    return () => window.removeEventListener(SHARES_CHANGED, reload);
  }, [enabled, reload]);
  usePoll(reload, POLL_MS, enabled);
  return read;
}

/** The shares of one record the caller holds (or, for the Admin, any record). */
export function useRecordShares(recordId) {
  const request = useCallback(
    (api, workspace, signal) => api.recordShares(workspace, recordId, signal),
    [recordId],
  );
  const read = useShareRead(request, readShareList, Boolean(recordId));
  return { ...read, shares: read.value?.outgoing || [] };
}

/** Who may receive one record (amendment 2), read when the Share window opens. */
export function useShareCandidates(collection, recordId) {
  const request = useCallback(
    (api, workspace, signal) => api.shareCandidates(workspace, collection, recordId, signal),
    [collection, recordId],
  );
  const read = useShareRead(request, readCandidates, true);
  return { ...read, colleagues: read.value || [] };
}

/** One share by its ID, for the link route (`GET /shares/{id}`). */
export function useShareView(id) {
  const request = useCallback((api, workspace, signal) => api.share(workspace, id, signal), [id]);
  return useShareRead(request, readShareResult, Boolean(id));
}
