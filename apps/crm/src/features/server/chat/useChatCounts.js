import { useCallback, useEffect, useState } from 'react';
import { usePoll } from '../inbox/usePoll.js';

const POLL_MS = 15_000;

/**
 * Team chat unread and mention counts (packet C3), read on every `refreshKey` change and
 * every 15 seconds while the page is visible. A failed read keeps the last counts.
 */
export function useChatCounts(api, workspaceId, refreshKey, enabled = true) {
  const [counts, setCounts] = useState({ unread: 0, mentions: 0 });
  const live = Boolean(enabled && workspaceId);
  const load = useCallback(
    (signal) =>
      live
        ? api
            .chatSummary(workspaceId, signal)
            .then((value) =>
              setCounts({
                unread: Number(value?.unread) || 0,
                mentions: Number(value?.mentions) || 0,
              }),
            )
            .catch(() => {})
        : Promise.resolve(),
    [api, live, workspaceId],
  );
  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [load, refreshKey]);
  usePoll(load, POLL_MS, live);
  return counts;
}
