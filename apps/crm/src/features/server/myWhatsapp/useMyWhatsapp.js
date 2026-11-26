import { useCallback, useEffect, useState } from 'react';
import { ownNumber } from '../channels/whatsappModel.js';

/**
 * The member's own WhatsApp number (W1a). Staff read only their own number; the Admin reads
 * every number of the company, so the list is narrowed to the signed-in member. A refusal
 * (403) means the WhatsApp grant was removed since this session started.
 */
export function useMyWhatsapp(api, workspaceId, memberId) {
  const [state, setState] = useState({ status: 'loading', loaded: false, number: null });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setState((current) => ({ ...current, status: 'loading' }));
    api
      .whatsappNumbers(workspaceId, controller.signal)
      .then((data) => {
        if (!Array.isArray(data?.numbers)) throw Error('incomplete');
        const number = ownNumber(data.numbers, memberId);
        if (!controller.signal.aborted) setState({ status: 'ready', loaded: true, number });
      })
      .catch((failure) => {
        if (failure.name === 'AbortError') return;
        const status = failure.status === 403 ? 'forbidden' : 'error';
        setState({ status, loaded: false, number: null });
      });
    return () => controller.abort();
  }, [api, workspaceId, memberId, attempt]);
  const reload = useCallback(() => setAttempt((value) => value + 1), []);
  /** Resolves to '' on success or the server's reason; the number is re-read either way. */
  const disconnect = async (fallback) => {
    try {
      await api.disconnectWhatsappNumber(workspaceId, state.number);
      return '';
    } catch (failure) {
      return failure.message || fallback;
    } finally {
      reload();
    }
  };
  return { ...state, reload, disconnect };
}
