import { useCallback, useEffect, useState } from 'react';
import { usePoll } from '../inbox/usePoll.js';

/** New offers from other companies appear without a reload while the page is visible. */
export const LIST_POLL_MS = 15_000;

/**
 * The caller's agreements: their own as a participant, or the whole company's for an Admin.
 * A failed refresh keeps the list already shown; only a failed first load is an error.
 */
export function useAgreements(api, workspaceId) {
  const [state, setState] = useState({ status: 'loading', items: [] });
  const load = useCallback(
    (signal) =>
      api
        .agreements(workspaceId, signal)
        .then((value) => {
          if (!Array.isArray(value?.agreements)) throw Error('incomplete');
          setState({ status: 'ready', items: value.agreements });
        })
        .catch((failure) => {
          if (failure.name === 'AbortError') return;
          setState((current) =>
            current.status === 'ready' ? current : { status: 'error', items: [] },
          );
        }),
    [api, workspaceId],
  );
  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [load]);
  usePoll(load, LIST_POLL_MS, state.status === 'ready');
  const reload = () => {
    setState((current) =>
      current.status === 'error' ? { ...current, status: 'loading' } : current,
    );
    return load();
  };
  return { ...state, reload };
}
