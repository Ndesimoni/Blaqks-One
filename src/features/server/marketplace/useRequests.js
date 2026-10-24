import { useCallback, useEffect, useState } from 'react';
import { useSession } from '../../../hooks/useSession.js';
import { draftFrom } from './requestOptions.js';
import { readBoard, readMyRequests, readRequirements } from './requestsModel.js';

const fail = (setState) => (failure) => {
  if (failure.name === 'AbortError') return;
  setState((last) => ({ ...last, loading: false, more: false, error: failure.message }));
};

/** The board, paged: `loadMore` appends; new filters start the list again. */
export function useBoard(filters) {
  const { api, user } = useSession();
  const key = JSON.stringify(filters);
  const [state, setState] = useState({
    requests: [],
    nextCursor: '',
    loading: true,
    more: false,
    error: '',
  });
  const load = useCallback(
    (cursor, signal) =>
      api
        .marketplaceBoard(user.workspaceId, { ...JSON.parse(key), cursor }, signal)
        .then((value) => {
          if (signal?.aborted) return;
          const page = readBoard(value);
          setState((last) => ({
            requests: cursor ? [...last.requests, ...page.requests] : page.requests,
            nextCursor: page.nextCursor,
            loading: false,
            more: false,
            error: '',
          }));
        })
        .catch(fail(setState)),
    [api, user.workspaceId, key],
  );
  useEffect(() => {
    const controller = new AbortController();
    setState((last) => ({ ...last, loading: true, error: '' }));
    load('', controller.signal);
    return () => controller.abort();
  }, [load]);
  const loadMore = useCallback(() => {
    setState((last) => ({ ...last, more: true }));
    load(state.nextCursor);
  }, [load, state.nextCursor]);
  const retry = useCallback(() => load(''), [load]);
  return { ...state, loadMore, retry };
}

/** The poster's own requests. */
export function useMyRequests() {
  const { api, user } = useSession();
  const [state, setState] = useState({ requests: [], loading: true, error: '', attempt: 0 });
  useEffect(() => {
    const controller = new AbortController();
    api
      .marketplaceRequests(user.workspaceId, controller.signal)
      .then((value) => {
        if (!controller.signal.aborted)
          setState((last) => ({
            ...last,
            requests: readMyRequests(value),
            loading: false,
            error: '',
          }));
      })
      .catch((failure) => {
        if (failure.name !== 'AbortError' && !controller.signal.aborted)
          setState((last) => ({ ...last, loading: false, error: failure.message }));
      });
    return () => controller.abort();
  }, [api, user.workspaceId, state.attempt]);
  const retry = useCallback(() => setState((last) => ({ ...last, attempt: last.attempt + 1 })), []);
  return { ...state, retry };
}

/** The requirements of one of the poster's clients, pre-filled for the form. */
export function useDraft(clientId) {
  const { api, user } = useSession();
  const [state, setState] = useState({ draft: null, loading: false, error: '' });
  useEffect(() => {
    if (!clientId) {
      setState({ draft: null, loading: false, error: '' });
      return undefined;
    }
    const controller = new AbortController();
    setState({ draft: null, loading: true, error: '' });
    api
      .marketplaceDraft(user.workspaceId, clientId, controller.signal)
      .then((value) => {
        if (!controller.signal.aborted)
          setState({ draft: draftFrom(readRequirements(value)), loading: false, error: '' });
      })
      .catch((failure) => {
        if (failure.name !== 'AbortError' && !controller.signal.aborted)
          setState({ draft: null, loading: false, error: failure.message });
      });
    return () => controller.abort();
  }, [api, user.workspaceId, clientId]);
  return state;
}
