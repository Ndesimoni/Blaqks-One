import { useCallback, useEffect, useState } from 'react';
import { useSession } from '../../../hooks/useSession.js';

/**
 * The member's broker chats across requests: `{ rows, loading, error, status, reload }`. A
 * member who has not joined the marketplace gets a 409, which the page explains.
 */
export function useMarketChats() {
  const { api, user } = useSession();
  const [state, setState] = useState({
    rows: null,
    loading: true,
    loadingMore: false,
    nextOffset: null,
    error: '',
    status: 0,
  });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setState((current) => ({ ...current, loading: true, error: '', status: 0 }));
    api
      .myMarketplaceConversations(user.workspaceId, 0, controller.signal)
      .then((value) => {
        if (!controller.signal.aborted)
          setState({
            rows: value?.conversations || [],
            loading: false,
            loadingMore: false,
            nextOffset: value?.nextOffset ?? null,
            error: '',
            status: 0,
          });
      })
      .catch((failure) => {
        if (failure.name === 'AbortError' || controller.signal.aborted) return;
        const status = failure.status || 0;
        setState((current) => ({
          ...current,
          rows: status >= 400 && status < 500 ? null : current.rows,
          loading: false,
          loadingMore: false,
          nextOffset: status >= 400 && status < 500 ? null : current.nextOffset,
          error: failure.message,
          status,
        }));
      });
    return () => controller.abort();
  }, [api, user.workspaceId, attempt]);
  const loadMore = useCallback(async () => {
    if (state.loadingMore || state.nextOffset == null) return;
    setState((current) => ({ ...current, loadingMore: true, error: '' }));
    try {
      const value = await api.myMarketplaceConversations(user.workspaceId, state.nextOffset);
      setState((current) => ({
        ...current,
        rows: [...(current.rows || []), ...(value?.conversations || [])],
        loadingMore: false,
        nextOffset: value?.nextOffset ?? null,
      }));
    } catch (failure) {
      const status = failure.status || 0;
      setState((current) => ({
        ...current,
        rows: status >= 400 && status < 500 ? null : current.rows,
        loadingMore: false,
        nextOffset: status >= 400 && status < 500 ? null : current.nextOffset,
        error: failure.message,
        status,
      }));
    }
  }, [api, user.workspaceId, state.loadingMore, state.nextOffset]);
  return {
    ...state,
    loadMore,
    reload: useCallback(() => setAttempt((value) => value + 1), []),
  };
}
