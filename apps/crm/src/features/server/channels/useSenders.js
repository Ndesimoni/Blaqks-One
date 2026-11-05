import { useCallback, useEffect, useState } from 'react';

/**
 * The WhatsApp senders in the company's Twilio account, read live from Twilio each time the
 * Give a number dialog opens, so a number registered a moment ago is offered. A refusal
 * keeps the server's own words in `message` (empty for an incomplete answer).
 */
export function useSenders(api, workspaceId) {
  const [state, setState] = useState({ senders: null, failed: false, message: '' });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setState({ senders: null, failed: false, message: '' });
    api
      .whatsappSenders(workspaceId, controller.signal)
      .then((data) => {
        if (!Array.isArray(data?.senders)) throw Error('incomplete');
        if (!controller.signal.aborted) setState({ senders: data.senders, failed: false });
      })
      .catch((failure) => {
        if (failure.name === 'AbortError') return;
        const message = failure.name === 'CrmApiError' ? failure.message : '';
        setState({ senders: null, failed: true, message });
      });
    return () => controller.abort();
  }, [api, workspaceId, attempt]);
  const retry = useCallback(() => setAttempt((value) => value + 1), []);
  return { ...state, retry };
}
