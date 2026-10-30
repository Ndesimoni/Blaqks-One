import { useCallback, useEffect, useRef, useState } from 'react';
import { POLL_MS } from './inboxModel.js';
import { usePoll } from './usePoll.js';

const initial = { rows: [], next: null, status: 'loading', error: '', more: false };

/**
 * One filtered conversation list. A change of filters starts again from the first page;
 * polling refreshes the rows already shown without moving the reader; Load more follows
 * `nextCursor`. Nothing is cached in browser storage.
 */
export function useInboxList(api, workspaceId, params) {
  const [state, setState] = useState(initial);
  const key = JSON.stringify(params);
  const shown = useRef(0);
  shown.current = state.rows.length;
  const fetchPage = useCallback(
    async (extra, signal) => {
      const result = await api.conversations(workspaceId, { ...params, ...extra }, signal);
      if (!Array.isArray(result?.conversations)) throw Error('incomplete');
      return result;
    },
    [api, workspaceId, key],
  );
  useEffect(() => {
    const controller = new AbortController();
    setState(initial);
    fetchPage({}, controller.signal)
      .then((page) =>
        setState({ ...initial, rows: page.conversations, next: page.nextCursor, status: 'ready' }),
      )
      .catch((failure) => {
        if (failure.name !== 'AbortError')
          setState({ ...initial, status: 'error', error: failure.message });
      });
    return () => controller.abort();
  }, [fetchPage]);
  const refresh = useCallback(() => {
    const limit = Math.min(100, Math.max(50, shown.current));
    fetchPage({ limit })
      .then((page) =>
        setState((current) =>
          current.status === 'loading'
            ? current
            : { ...current, rows: page.conversations, next: page.nextCursor, status: 'ready' },
        ),
      )
      .catch(() => {});
  }, [fetchPage]);
  usePoll(refresh, POLL_MS, state.status === 'ready');
  const loadMore = useCallback(() => {
    if (!state.next || state.more) return;
    setState((current) => ({ ...current, more: true }));
    fetchPage({ cursor: state.next })
      .then((page) =>
        setState((current) => ({
          ...current,
          rows: [...current.rows, ...page.conversations],
          next: page.nextCursor,
          more: false,
        })),
      )
      .catch(() => setState((current) => ({ ...current, more: false })));
  }, [fetchPage, state.next, state.more]);
  return { ...state, refresh, loadMore };
}
