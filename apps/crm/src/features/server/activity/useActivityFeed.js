import { useCallback, useEffect, useRef, useState } from 'react';

const initial = { items: [], next: null, status: 'loading', error: '', more: false, moreError: '' };

/** Validates one page: only the documented keys and kinds are accepted. */
export function readActivityPage(payload) {
  const rows = payload?.activity;
  const next = payload?.nextCursor;
  if (!Array.isArray(rows) || !(next === null || typeof next === 'string'))
    throw Error('The CRM server returned incomplete activity.');
  for (const row of rows)
    if (
      typeof row?.id !== 'string' ||
      typeof row.at !== 'string' ||
      !['record', 'team', 'channel'].includes(row.kind) ||
      typeof row.actor?.id !== 'string'
    )
      throw Error('The CRM server returned invalid activity.');
  return { rows, next };
}

/**
 * One filtered activity feed for the selected workspace. A change of workspace or parameters
 * discards every loaded page and starts again from the first; Load more follows `nextCursor`.
 * Nothing is cached in browser storage and a failure never falls back to demo data.
 */
export function useActivityFeed(api, workspaceId, params) {
  const [state, setState] = useState(initial);
  const [attempt, setAttempt] = useState(0);
  const key = params ? JSON.stringify(params) : '';
  const current = useRef(key);
  current.current = key;
  useEffect(() => {
    if (!key) {
      setState({ ...initial, status: 'invalid' });
      return undefined;
    }
    const controller = new AbortController();
    setState(initial);
    api
      .activity(workspaceId, JSON.parse(key), controller.signal)
      .then((payload) => {
        const { rows, next } = readActivityPage(payload);
        if (!controller.signal.aborted)
          setState({ ...initial, items: rows, next, status: 'ready' });
      })
      .catch((failure) => {
        if (failure.name === 'AbortError' || controller.signal.aborted) return;
        const status = failure.status === 403 ? 'forbidden' : 'error';
        setState({ ...initial, status, error: failure.message });
      });
    return () => controller.abort();
  }, [api, workspaceId, key, attempt]);
  const retry = useCallback(() => setAttempt((value) => value + 1), []);
  const loadMore = useCallback(async () => {
    if (!state.next || state.more) return;
    const requested = key;
    setState((previous) => ({ ...previous, more: true, moreError: '' }));
    try {
      const payload = await api.activity(workspaceId, { ...JSON.parse(key), cursor: state.next });
      const { rows, next } = readActivityPage(payload);
      if (current.current !== requested) return;
      setState((previous) => {
        const seen = new Set(previous.items.map((item) => item.id));
        const fresh = rows.filter((item) => !seen.has(item.id));
        return { ...previous, items: [...previous.items, ...fresh], next, more: false };
      });
    } catch (failure) {
      if (current.current !== requested) return;
      setState((previous) => ({ ...previous, more: false, moreError: failure.message }));
    }
  }, [api, workspaceId, key, state.next, state.more]);
  return { ...state, retry, loadMore };
}
