import { useCallback, useEffect, useState } from 'react';
import { usePoll } from './usePoll.js';

const empty = { unread: 0, mine: 0, unassigned: 0, channels: [], ready: false };

/**
 * Unread, Mine and Unassigned counts plus channel states for the sidebar badge, the tabs
 * and the banners. Failures keep the last good summary; nothing falls back to demo data.
 */
export function useInboxSummary(api, workspaceId, ms) {
  const [summary, setSummary] = useState(empty);
  const load = useCallback(
    (signal) =>
      api
        .inboxSummary(workspaceId, signal)
        .then((value) => {
          if (Array.isArray(value?.channels)) setSummary({ ...empty, ...value, ready: true });
        })
        .catch(() => {}),
    [api, workspaceId],
  );
  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [load]);
  usePoll(load, ms, Boolean(workspaceId));
  return { ...summary, refresh: load };
}
