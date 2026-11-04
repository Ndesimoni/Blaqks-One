import { useCallback, useEffect, useState } from 'react';
import { useSession } from '../../../hooks/useSession.js';

const POLL_MS = 15_000;

/**
 * One broker chat's messages, refreshed every fifteen seconds while open. A refresh keeps the
 * messages on screen, so sending or polling never blanks the conversation.
 */
export function useBrokerThread(conversationId) {
  const { api, user } = useSession();
  const [state, setState] = useState({ messages: null, error: '' });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    api
      .marketplaceMessages(user.workspaceId, conversationId, controller.signal)
      .then((value) => {
        if (!controller.signal.aborted) setState({ messages: value?.messages || [], error: '' });
      })
      .catch((failure) => {
        if (!controller.signal.aborted)
          setState((current) => ({ ...current, error: failure.message }));
      });
    return () => controller.abort();
  }, [api, user.workspaceId, conversationId, attempt]);
  const reload = useCallback(() => setAttempt((value) => value + 1), []);
  useEffect(() => {
    const timer = setInterval(reload, POLL_MS);
    return () => clearInterval(timer);
  }, [reload]);
  return { ...state, reload };
}
