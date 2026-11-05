import { useCallback, useEffect, useState } from 'react';
import { useSession } from '../../../hooks/useSession.js';
import { readRequests } from './helpModel.js';

/** The Blaqks One queue (BO1c): `{ rows, counts, people, error, filter, setFilter, reload }`. */
export function usePlatformHelp() {
  const { api } = useSession();
  const [filter, setFilter] = useState({ state: 'open', assigned: 'all' });
  const [state, setState] = useState({ rows: null, counts: {}, error: '' });
  const [people, setPeople] = useState([]);
  const [attempt, setAttempt] = useState(0);
  const reload = useCallback(() => setAttempt((value) => value + 1), []);
  useEffect(() => {
    const controller = new AbortController();
    api
      .helpQueue(filter, controller.signal)
      .then((value) => {
        const rows = readRequests(value);
        if (!controller.signal.aborted) setState({ rows, counts: value.counts || {}, error: '' });
      })
      .catch((failure) => {
        if (failure.name === 'AbortError' || controller.signal.aborted) return;
        setState((current) => ({ ...current, error: failure.message }));
      });
    return () => controller.abort();
  }, [api, filter, attempt]);
  useEffect(() => {
    const controller = new AbortController();
    api
      .helpPeople(controller.signal)
      .then((value) => !controller.signal.aborted && setPeople(value.people || []))
      .catch(() => {});
    return () => controller.abort();
  }, [api]);
  return { ...state, people, filter, setFilter, reload };
}
