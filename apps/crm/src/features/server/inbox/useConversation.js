import { useCallback, useEffect, useState } from 'react';
import { POLL_MS } from './inboxModel.js';
import { usePoll } from './usePoll.js';

const initial = { data: null, status: 'idle', error: '' };

/**
 * The open conversation: loads it, marks it read, polls for new messages and runs changes.
 * `onChanged` lets the list and badge refresh after a change.
 */
export function useConversation(api, workspaceId, id, onChanged) {
  const [state, setState] = useState(initial);
  const load = useCallback(
    (signal) =>
      api.conversation(workspaceId, id, signal).then((data) => {
        if (!data?.conversation) throw Error('incomplete');
        return data;
      }),
    [api, workspaceId, id],
  );
  useEffect(() => {
    if (!id) {
      setState(initial);
      return undefined;
    }
    const controller = new AbortController();
    setState({ ...initial, status: 'loading' });
    load(controller.signal)
      .then((data) => {
        setState({ data, status: 'ready', error: '' });
        if (data.conversation.unread)
          api.markConversationRead(workspaceId, id).then(onChanged, () => {});
      })
      .catch((failure) => {
        if (failure.name !== 'AbortError')
          setState({ data: null, status: 'error', error: failure.message });
      });
    return () => controller.abort();
  }, [load]);
  const refresh = useCallback(() => {
    load()
      .then((data) => {
        setState((current) => (current.status === 'ready' ? { ...current, data } : current));
        if (data.conversation.unread)
          api.markConversationRead(workspaceId, id).then(onChanged, () => {});
      })
      .catch(() => {});
  }, [load, api, workspaceId, id, onChanged]);
  usePoll(refresh, POLL_MS, state.status === 'ready');
  /** Runs one change; returns '' on success or the server's message. */
  const run = useCallback(
    async (change) => {
      try {
        await change();
        refresh();
        onChanged?.();
        return '';
      } catch (failure) {
        refresh();
        return failure.message || 'error';
      }
    },
    [refresh, onChanged],
  );
  const version = state.data?.conversation?.version;
  return {
    ...state,
    refresh,
    addNote: (body) => run(() => api.addConversationNote(workspaceId, id, { body })),
    /** Email sending (E1b): a reply, or one failed message sent again. */
    reply: (body, attachments = []) =>
      run(() =>
        api.replyToConversation(
          workspaceId,
          id,
          attachments.length ? { body, attachments } : { body },
        ),
      ),
    /** Where one of a message's attachments opens (F3a). */
    fileUrl: (message, file) => api.inboxFileUrl(workspaceId, id, message, file),
    sendAgain: (message) => run(() => api.sendMessageAgain(workspaceId, id, message)),
    update: (changes) =>
      run(() => api.updateConversation(workspaceId, id, { expectedVersion: version, ...changes })),
    /** Triage (plan U2): each answers '' on success or the server's message. */
    createLead: (fields) =>
      run(() =>
        api.createLeadFromConversation(workspaceId, id, { expectedVersion: version, ...fields }),
      ),
    link: (collection, recordId) =>
      run(() =>
        api.linkConversation(workspaceId, id, { expectedVersion: version, collection, recordId }),
      ),
    resolve: () =>
      run(() => api.resolveConversation(workspaceId, id, { expectedVersion: version })),
    block: () => run(() => api.blockConversation(workspaceId, id, { expectedVersion: version })),
    unblock: () =>
      run(() => api.unblockConversation(workspaceId, id, { expectedVersion: version })),
  };
}
