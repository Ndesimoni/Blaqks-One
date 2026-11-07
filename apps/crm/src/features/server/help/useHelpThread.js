import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { readThread } from './helpModel.js';

/**
 * One help request's thread for either side: `read(id, signal)` loads it and
 * `send(id, body)` posts a reply. Returns `{ thread, error, busy, reload, post, setError }`.
 */
export function useHelpThread(id, read, send) {
  const calls = useRef({ read, send });
  useLayoutEffect(() => {
    calls.current = { read, send };
  });
  const [thread, setThread] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    setThread(null);
    setError('');
    if (!id) return undefined;
    const controller = new AbortController();
    calls.current
      .read(id, controller.signal)
      .then((value) => {
        if (!controller.signal.aborted) setThread(readThread(value));
      })
      .catch((failure) => {
        if (failure.name !== 'AbortError' && !controller.signal.aborted) setError(failure.message);
      });
    return () => controller.abort();
  }, [id, attempt]);
  const reload = useCallback(() => setAttempt((value) => value + 1), []);
  const post = async (body) => {
    setBusy(true);
    setError('');
    try {
      await calls.current.send(id, { body });
      reload();
      return true;
    } catch (failure) {
      setError(failure.message);
      return false;
    } finally {
      setBusy(false);
    }
  };
  return { thread, error, busy, reload, post, setError };
}
