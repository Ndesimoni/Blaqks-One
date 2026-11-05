import { useCallback, useEffect, useState } from 'react';
import { useSession } from '../../hooks/useSession.js';
import { usePoll } from './inbox/usePoll.js';

const POLL_MS = 15_000;

/**
 * A "waiting for you" count from a `waitingSources` entry (agreements design §17), read on
 * every `refreshKey` change, on the source's change event, and every `interval` while the page
 * is visible. A failed read keeps the last count; a disabled source stays at zero.
 */
export function useWaitingCount(source, enabled, refreshKey, interval = POLL_MS) {
  const { api, user } = useSession();
  const workspace = user?.workspaceId;
  const live = Boolean(enabled && source && workspace);
  const [count, setCount] = useState(0);
  const load = useCallback(
    (signal) =>
      live
        ? source
            .read(api, workspace, signal)
            .then(setCount)
            .catch(() => {})
        : Promise.resolve(),
    [api, live, source, workspace],
  );
  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [load, refreshKey]);
  useEffect(() => {
    if (!live || !source.event) return undefined;
    const refresh = () => load();
    window.addEventListener(source.event, refresh);
    return () => window.removeEventListener(source.event, refresh);
  }, [live, load, source]);
  usePoll(load, interval, live);
  return live ? count : 0;
}
