import { useCallback, useEffect, useState } from 'react';
import { usePoll } from '../inbox/usePoll.js';

export const ROOMS_POLL_MS = 5000;
const empty = { rooms: [], people: [], canCreateChannel: false };

/**
 * The member's channels, groups and direct conversations (with unread and mention counts)
 * and the colleagues they can message, refreshed while visible. Starting a channel, group
 * or direct conversation returns the room, or the server's message.
 */
export function useChat(api, workspaceId) {
  const [state, setState] = useState({ status: 'loading', data: empty });
  const load = useCallback(
    (signal) =>
      api
        .chat(workspaceId, signal)
        .then((data) => {
          if (!Array.isArray(data?.rooms)) throw Error('incomplete');
          setState({ status: 'ready', data });
        })
        .catch((failure) => {
          if (failure.name === 'AbortError') return;
          setState((current) =>
            current.status === 'ready' ? current : { ...current, status: 'error' },
          );
        }),
    [api, workspaceId],
  );
  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [load]);
  usePoll(load, ROOMS_POLL_MS, state.status === 'ready');
  const start = async (action) => {
    try {
      const { room } = await action();
      await load();
      return { room };
    } catch (failure) {
      return { error: failure.message || 'error' };
    }
  };
  return {
    ...state.data,
    status: state.status,
    refresh: load,
    createChannel: (name) => start(() => api.createChannel(workspaceId, name)),
    openDirect: (memberId) => start(() => api.openDirect(workspaceId, memberId)),
    createGroup: (memberIds, name) => start(() => api.createGroup(workspaceId, memberIds, name)),
    /** Leaves a group; answers '' or the server's message. */
    leave: async (roomId) => {
      try {
        await api.leaveChat(workspaceId, roomId);
        await load();
        return '';
      } catch (failure) {
        return failure.message || 'error';
      }
    },
  };
}
