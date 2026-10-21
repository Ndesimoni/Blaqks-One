import { useCallback, useEffect, useRef, useState } from 'react';
import { usePoll } from '../inbox/usePoll.js';
import { mergeMessages } from './chatModel.js';

const ROOM_POLL_MS = 4000;

/**
 * One room's messages: the latest page, polled while visible, plus earlier pages on
 * request. Marks the room read after loading. Each action answers '' or the server's message.
 */
export function useRoom(api, workspaceId, roomId, onRead) {
  const [state, setState] = useState({ status: 'idle', messages: [], more: false });
  // The caller's callback changes each render; reading it through a ref keeps the loaders
  // stable, so a refresh never restarts the room.
  const readRef = useRef(onRead);
  readRef.current = onRead;
  const marked = useRef('');
  const latest = useCallback(
    (signal) =>
      api.chatMessages(workspaceId, roomId, null, signal).then((page) => {
        setState((current) => ({
          status: 'ready',
          messages: mergeMessages(
            current.status === 'ready' ? current.messages : [],
            page.messages,
          ),
          more: current.status === 'ready' ? current.more : page.more,
        }));
        // Mark read only when something new arrived since the last mark.
        const newest = page.messages.at(-1)?.id ?? 'empty';
        if (marked.current === newest) return;
        marked.current = newest;
        api.markChatRead(workspaceId, roomId).then(
          () => readRef.current?.(),
          () => {},
        );
      }),
    [api, workspaceId, roomId],
  );
  useEffect(() => {
    if (!roomId) return undefined;
    const controller = new AbortController();
    setState({ status: 'loading', messages: [], more: false });
    latest(controller.signal).catch((failure) => {
      if (failure.name !== 'AbortError') setState({ status: 'error', messages: [], more: false });
    });
    return () => controller.abort();
  }, [roomId, latest]);
  const refresh = useCallback(() => latest().catch(() => {}), [latest]);
  usePoll(refresh, ROOM_POLL_MS, state.status === 'ready');
  const earlier = async () => {
    const first = state.messages[0];
    if (!first) return;
    const page = await api.chatMessages(workspaceId, roomId, first.id).catch(() => null);
    if (page)
      setState((current) => ({
        ...current,
        messages: mergeMessages(page.messages, current.messages),
        more: page.more,
      }));
  };
  const run = async (action) => {
    try {
      const result = await action();
      if (result?.message)
        setState((current) => ({
          ...current,
          messages: mergeMessages(current.messages, [result.message]),
        }));
      return '';
    } catch (failure) {
      return failure.message || 'error';
    }
  };
  return {
    ...state,
    earlier,
    send: (body, files = []) => run(() => api.sendChat(workspaceId, roomId, body, files)),
    edit: (id, body) => run(() => api.editChat(workspaceId, roomId, id, body)),
    remove: (id) => run(() => api.deleteChat(workspaceId, roomId, id)),
  };
}
