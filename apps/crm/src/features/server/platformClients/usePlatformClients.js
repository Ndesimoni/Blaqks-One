import { useCallback, useEffect, useState } from 'react';
import { useSession } from '../../../hooks/useSession.js';
import { readClientList } from './clientShapes.js';
import { listParams } from './clientsModel.js';

const initial = { rows: null, counts: null, next: null, error: '', more: false, moreError: '' };

/** `value` once it has stopped changing for `delay` ms (search typing). */
function useSettled(value, delay) {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return settled;
}

/**
 * Blaqks One's clients for one view `{ stage, query, owner }` (BO1e). A new view starts from
 * the first page and keeps the rows already shown until it arrives (`loading`); Load more
 * follows `nextCursor`. Nothing is kept in browser storage.
 */
export function usePlatformClients(view) {
  const { api } = useSession();
  const [state, setState] = useState(initial);
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const query = useSettled(view.query, 250);
  const key = JSON.stringify(listParams({ ...view, query }));
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    api
      .platformClients(JSON.parse(key), controller.signal)
      .then((value) => {
        const page = readClientList(value);
        if (controller.signal.aborted) return;
        setState({
          ...initial,
          rows: page.clients,
          counts: page.stageCounts,
          next: page.nextCursor,
        });
        setLoading(false);
      })
      .catch((failure) => {
        if (failure.name === 'AbortError' || controller.signal.aborted) return;
        setState((current) => ({ ...current, error: failure.message }));
        setLoading(false);
      });
    return () => controller.abort();
  }, [api, key, attempt]);
  const reload = useCallback(() => setAttempt((value) => value + 1), []);
  const loadMore = async () => {
    if (!state.next || state.more) return;
    setState((current) => ({ ...current, more: true, moreError: '' }));
    try {
      const next = readClientList(
        await api.platformClients({ ...JSON.parse(key), cursor: state.next }),
      );
      setState((current) => ({
        ...current,
        rows: [...current.rows, ...next.clients],
        next: next.nextCursor,
        more: false,
      }));
    } catch (failure) {
      setState((current) => ({ ...current, more: false, moreError: failure.message }));
    }
  };
  return { ...state, loading, searching: query !== view.query, reload, loadMore };
}
