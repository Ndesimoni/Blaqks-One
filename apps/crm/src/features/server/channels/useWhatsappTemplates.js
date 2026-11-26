import { useCallback, useEffect, useState } from 'react';

/**
 * The company's WhatsApp templates as Twilio last listed them (W1b, design §8), with when
 * they were read and whether that read worked. Refresh reads Twilio again; it resolves to ''
 * or the server's reason, and a failed read keeps the list it had.
 */
export function useWhatsappTemplates(api, workspaceId, key) {
  const [state, setState] = useState({ view: null, error: false });
  const [attempt, setAttempt] = useState(0);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!key) return undefined;
    const controller = new AbortController();
    setState((current) => ({ ...current, error: false }));
    api
      .whatsappTemplates(workspaceId, controller.signal)
      .then((view) => {
        if (!Array.isArray(view?.templates)) throw Error('incomplete');
        setState({ view, error: false });
      })
      .catch((failure) => {
        if (failure.name !== 'AbortError') setState((current) => ({ ...current, error: true }));
      });
    return () => controller.abort();
  }, [api, workspaceId, key, attempt]);
  const reload = useCallback(() => setAttempt((value) => value + 1), []);
  const refresh = async () => {
    setBusy(true);
    try {
      const view = await api.refreshWhatsappTemplates(workspaceId);
      if (Array.isArray(view?.templates)) setState({ view, error: false });
      return '';
    } catch (failure) {
      reload();
      return failure.message || 'error';
    } finally {
      setBusy(false);
    }
  };
  return { ...state, busy, reload, refresh };
}
