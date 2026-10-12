import { useCallback, useContext, useEffect, useState } from 'react';
import { useSession } from '../../../hooks/useSession.js';
import { WorkspaceScopeContext } from '../../../app/WorkspaceScopeContext.js';
import { isAssignable } from './assignmentModel.js';
import { readAssignees } from './assignmentResponses.js';

const idle = { people: [], loading: false, error: '' };

/** Eligible assignees for one collection in the active workspace (GET assignees, M5). */
export function useAssignees(collection, enabled = true) {
  const { api } = useSession();
  const { owner } = useContext(WorkspaceScopeContext);
  const [state, setState] = useState(idle);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!enabled || !isAssignable(collection)) {
      setState(idle);
      return undefined;
    }
    const controller = new AbortController();
    setState((previous) => ({ ...previous, loading: true, error: '' }));
    api
      .assignees(owner.id, collection, controller.signal)
      .then((payload) => {
        if (!controller.signal.aborted)
          setState({ people: readAssignees(payload), loading: false, error: '' });
      })
      .catch((failure) => {
        if (failure.name === 'AbortError' || controller.signal.aborted) return;
        setState({ people: [], loading: false, error: failure.message });
      });
    return () => controller.abort();
  }, [api, owner.id, collection, enabled, attempt]);
  const retry = useCallback(() => setAttempt((previous) => previous + 1), []);
  return { ...state, retry };
}
