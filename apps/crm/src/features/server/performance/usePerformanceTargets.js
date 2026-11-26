import { useCallback, useEffect, useState } from 'react';
import { mergeTarget, readSavedTarget, readTargets } from './targetsModel.js';

const empty = { targets: [], canEdit: false, loading: true, error: '' };

/**
 * One month's targets for the selected workspace (`GET /performance/targets`). The server
 * returns only the targets this caller may see; nothing is kept in browser storage, and a
 * workspace or month change discards the previous response.
 */
export function usePerformanceTargets(api, workspaceId, month) {
  const [state, setState] = useState(empty);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setState(empty);
    api
      .performanceTargets(workspaceId, month, controller.signal)
      .then((payload) => {
        if (controller.signal.aborted) return;
        const parsed = readTargets(payload);
        setState({ targets: parsed.targets, canEdit: parsed.canEdit, loading: false, error: '' });
      })
      .catch((failure) => {
        if (failure.name === 'AbortError' || controller.signal.aborted) return;
        setState({ ...empty, loading: false, error: failure.message });
      });
    return () => controller.abort();
  }, [api, workspaceId, month, attempt]);
  const retry = useCallback(() => setAttempt((previous) => previous + 1), []);
  /** Saves one target; a version conflict reloads the month so the next save is current. */
  const save = useCallback(
    async ({ memberId, metric, value, version }) => {
      try {
        const payload = await api.saveTarget(workspaceId, {
          month,
          memberId,
          metric,
          value,
          version,
        });
        const saved = readSavedTarget(payload);
        setState((previous) => ({
          ...previous,
          targets: mergeTarget(previous.targets, memberId, metric, saved),
        }));
        return saved;
      } catch (failure) {
        if (failure.status === 409) retry();
        throw failure;
      }
    },
    [api, workspaceId, month, retry],
  );
  return { ...state, retry, save };
}
