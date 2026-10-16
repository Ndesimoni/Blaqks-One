import { useEffect, useState } from 'react';
import { readTargets } from '../performance/targetsModel.js';

const none = { targets: [], loading: false, error: '' };

/**
 * This month's performance targets for the Dashboard's target bars. It asks only when the
 * caller may already open Performance (`enabled`); the server still returns only the targets
 * this caller may see. Nothing is stored, and a failure simply hides the target bars.
 */
export function useDashboardTargets(api, workspaceId, month, enabled) {
  const [state, setState] = useState(enabled ? { ...none, loading: true } : none);
  useEffect(() => {
    if (!enabled || !workspaceId) {
      setState(none);
      return undefined;
    }
    const controller = new AbortController();
    setState({ ...none, loading: true });
    api
      .performanceTargets(workspaceId, month, controller.signal)
      .then((payload) => {
        if (!controller.signal.aborted)
          setState({ targets: readTargets(payload).targets, loading: false, error: '' });
      })
      .catch((failure) => {
        if (failure.name === 'AbortError' || controller.signal.aborted) return;
        setState({ ...none, error: failure.message });
      });
    return () => controller.abort();
  }, [api, workspaceId, month, enabled]);
  return state;
}
