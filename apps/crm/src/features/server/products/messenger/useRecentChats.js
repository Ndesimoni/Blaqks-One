import { useCallback, useEffect, useState } from 'react';
import { listParams } from '../../inbox/inboxModel.js';
import { usePoll } from '../../inbox/usePoll.js';

const STRIP_POLL_MS = 30_000;
const empty = { rows: [], rooms: [], people: [] };

/**
 * The newest Client inbox conversations assigned to this person and their Team chat rooms,
 * for the chat strip: read on `refreshKey` changes and every 30 seconds while the page is
 * visible. Only boxes the person may open are read; a failed read keeps the last lists.
 */
export function useRecentChats(api, workspaceId, { inbox, team }, refreshKey) {
  const [state, setState] = useState(empty);
  const load = useCallback(
    async (signal) => {
      const [rows, chat] = await Promise.all([
        inbox
          ? api
              .conversations(workspaceId, listParams('mine'), signal)
              .then((value) => (Array.isArray(value?.conversations) ? value.conversations : null))
              .catch(() => null)
          : [],
        team ? api.chat(workspaceId, signal).catch(() => null) : { rooms: [], people: [] },
      ]);
      if (signal?.aborted) return;
      setState((current) => ({
        rows: rows ?? current.rows,
        rooms: Array.isArray(chat?.rooms) ? chat.rooms : current.rooms,
        people: Array.isArray(chat?.people) ? chat.people : current.people,
      }));
    },
    [api, workspaceId, inbox, team],
  );
  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [load, refreshKey]);
  usePoll(load, STRIP_POLL_MS, Boolean(workspaceId && (inbox || team)));
  return state;
}
