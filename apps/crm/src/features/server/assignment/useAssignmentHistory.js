import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useSession } from '../../../hooks/useSession.js';
import { WorkspaceScopeContext } from '../../../app/WorkspaceScopeContext.js';
import { readAssignmentHistory } from './assignmentResponses.js';

/** Loads a record's assignment history on request (M4); notes are shown only here. */
export function useAssignmentHistory(collection, entry) {
  const { api } = useSession();
  const { owner } = useContext(WorkspaceScopeContext);
  const [state, setState] = useState({ history: null, loading: false, error: '' });
  const controller = useRef(null);
  const id = entry?.id;
  const version = entry?.version;
  useEffect(() => {
    setState({ history: null, loading: false, error: '' });
    return () => controller.current?.abort();
  }, [id, version]);
  const load = useCallback(async () => {
    if (!id) return;
    controller.current?.abort();
    const current = new AbortController();
    controller.current = current;
    setState((previous) => ({ ...previous, loading: true, error: '' }));
    try {
      const payload = await api.assignmentHistory(owner.id, collection, id, current.signal);
      if (!current.signal.aborted)
        setState({ history: readAssignmentHistory(payload), loading: false, error: '' });
    } catch (failure) {
      if (failure.name === 'AbortError' || current.signal.aborted) return;
      setState({ history: null, loading: false, error: failure.message });
    }
  }, [api, owner.id, collection, id]);
  return { ...state, load };
}
