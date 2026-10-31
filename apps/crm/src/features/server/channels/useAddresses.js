import { useCallback, useEffect, useState } from 'react';

/**
 * The company's sending addresses and its team (for names and the member picker). Loads
 * only while a SendGrid connection is live; `key` changes when that connection does.
 */
export function useAddresses(api, workspaceId, key) {
  const [state, setState] = useState({ data: null, members: [], error: '' });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!key) return undefined;
    const controller = new AbortController();
    setState((current) => ({ ...current, error: '' }));
    Promise.all([
      api.emailAddresses(workspaceId, controller.signal),
      api.team(workspaceId, controller.signal),
    ])
      .then(([data, team]) => {
        if (!Array.isArray(data?.addresses) || !Array.isArray(team?.members))
          throw Error('incomplete');
        if (!controller.signal.aborted) setState({ data, members: team.members, error: '' });
      })
      .catch((failure) => {
        if (failure.name !== 'AbortError')
          setState((current) => ({ ...current, error: failure.message || 'error' }));
      });
    return () => controller.abort();
  }, [api, workspaceId, key, attempt]);
  const reload = useCallback(() => setAttempt((value) => value + 1), []);
  return { ...state, reload };
}
