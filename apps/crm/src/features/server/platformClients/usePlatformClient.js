import { useCallback, useEffect, useState } from 'react';
import { useSession } from '../../../hooks/useSession.js';
import { readClientDetail } from './clientShapes.js';

/**
 * One Blaqks One client with its timeline (BO1e), and the changes Manage allows: save fields,
 * log a call or message, archive. Every change sends the version it read; a 409 means someone
 * changed the client meanwhile, so the slider offers Reload. `onChanged` refreshes the list.
 * Each change resolves `{ ok, result }` or `{ ok: false, message, conflict }`.
 */
export function usePlatformClient(id, onChanged) {
  const { api } = useSession();
  const [state, setState] = useState({ detail: null, error: '' });
  const [busy, setBusy] = useState('');
  const [problem, setProblem] = useState(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    api
      .platformClient(id, controller.signal)
      .then((value) => {
        const detail = readClientDetail(value);
        if (!controller.signal.aborted) setState({ detail, error: '' });
      })
      .catch((failure) => {
        if (failure.name === 'AbortError' || controller.signal.aborted) return;
        setState((current) => ({ ...current, error: failure.message }));
      });
    return () => controller.abort();
  }, [api, id, attempt]);
  const reload = useCallback(() => {
    setProblem(null);
    setAttempt((value) => value + 1);
  }, []);
  /** Runs one change; `quiet` leaves the slider's message to the caller (the edit form). */
  const run = async (name, call, quiet = false) => {
    setBusy(name);
    setProblem(null);
    try {
      const result = await call();
      onChanged?.();
      setAttempt((value) => value + 1);
      return { ok: true, result };
    } catch (failure) {
      const outcome = { ok: false, message: failure.message, conflict: failure.status === 409 };
      if (!quiet) setProblem(outcome);
      return outcome;
    } finally {
      setBusy('');
    }
  };
  const version = state.detail?.client.version;
  const update = (fields, name = 'update', quiet = false) =>
    run(name, () => api.updatePlatformClient(id, { version, ...fields }), quiet);
  const log = (kind, body) => run('log', () => api.logPlatformClient(id, { kind, body }), true);
  const archive = () => run('archive', () => api.archivePlatformClient(id, { version }));
  return { ...state, busy, problem, reload, update, log, archive };
}
