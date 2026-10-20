import { useCallback, useEffect, useState } from 'react';

/**
 * The member's own mailbox (E1a): whether Google mail is set up, whether they may connect,
 * and their mailbox if any. Connect leaves for Google's sign-in page.
 */
export function useMailbox(api, workspaceId) {
  const [state, setState] = useState({ status: 'loading', data: null, error: '' });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setState((current) => ({ ...current, status: 'loading', error: '' }));
    api
      .mailbox(workspaceId, controller.signal)
      .then((data) => {
        if (typeof data?.google !== 'boolean') throw Error('incomplete');
        setState({ status: 'ready', data, error: '' });
      })
      .catch((failure) => {
        if (failure.name !== 'AbortError')
          setState({ status: 'error', data: null, error: failure.message });
      });
    return () => controller.abort();
  }, [api, workspaceId, attempt]);
  const reload = useCallback(() => setAttempt((value) => value + 1), []);
  /** Opens Google's sign-in in this tab; returns the server's message on failure. */
  const connect = async () => {
    try {
      const { url } = await api.startGoogleSignIn(workspaceId);
      window.location.assign(url);
      return '';
    } catch (failure) {
      return failure.message || 'error';
    }
  };
  const disconnect = async () => {
    try {
      await api.disconnectMailbox(workspaceId, { expectedVersion: state.data.mailbox.version });
      reload();
      return '';
    } catch (failure) {
      reload();
      return failure.message || 'error';
    }
  };
  return { ...state, reload, connect, disconnect };
}
