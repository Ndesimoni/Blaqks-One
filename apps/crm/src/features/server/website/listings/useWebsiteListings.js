import { useCallback, useEffect, useState } from 'react';
import { useSession } from '../../../../hooks/useSession.js';

/**
 * The caller's website publications (an Admin sees the company's, staff only their own)
 * plus Withdraw. Reloads keep the current rows on screen; only the first read shows the
 * loading state. Nothing is read when `enabled` is false.
 */
export function useWebsiteListings(enabled = true) {
  const { api, user } = useSession();
  const workspace = user.workspaceId || user.id;
  const [state, setState] = useState({ loaded: false, error: '', publications: [] });
  const [attempt, setAttempt] = useState(0);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!enabled) return undefined;
    const controller = new AbortController();
    setState((previous) => ({ ...previous, error: '' }));
    api
      .websitePublications(workspace, controller.signal)
      .then((value) => {
        if (controller.signal.aborted) return;
        const publications = Array.isArray(value?.publications) ? value.publications : [];
        setState({ loaded: true, error: '', publications });
      })
      .catch((error) => {
        if (error.name !== 'AbortError')
          setState((previous) => ({ ...previous, loaded: true, error: error.message }));
      });
    return () => controller.abort();
  }, [api, workspace, enabled, attempt]);
  const reload = useCallback(() => setAttempt((value) => value + 1), []);
  const withdraw = useCallback(
    async (publication) => {
      setBusy(true);
      try {
        await api.withdrawPropertyWebsite(workspace, publication.id, publication.version);
        reload();
        return { ok: true };
      } catch (error) {
        if (error.status === 409 || error.status === 404) reload();
        return { ok: false, message: error.message };
      } finally {
        setBusy(false);
      }
    },
    [api, workspace, reload],
  );
  return {
    loading: enabled && !state.loaded,
    error: state.error,
    publications: state.publications,
    reload,
    withdraw,
    busy,
  };
}
