import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { calendarSnapshot } from '../features/calendar/selectors.js';
import { calendarRequest } from '../services/calendar/client.js';
import { STORAGE } from '../config/storage.js';

export function useCalendarSync({ data, db, storageError, recovery }) {
  const [status, setStatus] = useState({
    configured: false,
    connected: false,
    calendar: null,
    items: {},
  });
  const [available, setAvailable] = useState(null);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const lastSent = useRef('');
  const revision = useRef(0);
  const snapshot = useMemo(() => JSON.stringify(calendarSnapshot(data, db.demo)), [data, db.demo]);
  const refresh = useCallback(async (signal) => {
    try {
      const result = await calendarRequest('status', { signal });
      setStatus(result);
      setAvailable(true);
      setRetry((value) => value + 1);
      return result;
    } catch (failure) {
      if (failure.name !== 'AbortError') setAvailable(false);
      return null;
    }
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    refresh(controller.signal);
    const interval = setInterval(() => {
      refresh(controller.signal);
    }, 10000);
    const onFocus = () => {
      refresh(controller.signal);
    };
    window.addEventListener('focus', onFocus);
    window.addEventListener('online', onFocus);
    return () => {
      controller.abort();
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('online', onFocus);
    };
  }, [refresh]);

  useEffect(() => {
    if (!status.connected) {
      lastSent.current = '';
      return;
    }
    if (!status.calendar || !available || storageError || recovery?.error) return;
    const fingerprint = `${status.calendar.id}:${snapshot}`;
    if (lastSent.current === fingerprint) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      // An older open tab must not cancel activities added in another tab.
      try {
        if (localStorage.getItem(STORAGE) !== JSON.stringify(db)) {
          setError('Another tab changed the CRM. Reload this tab before syncing.');
          return;
        }
        revision.current = Math.max(Date.now(), revision.current + 1, (status.revision || 0) + 1);
        const result = await calendarRequest('snapshot', {
          method: 'PUT',
          csrf: status.csrf,
          body: { events: JSON.parse(snapshot), revision: revision.current },
          signal: controller.signal,
        });
        if (!controller.signal.aborted) {
          lastSent.current = fingerprint;
          setStatus(result);
          setError('');
        }
      } catch (failure) {
        if (failure.name !== 'AbortError') setError(failure.message);
      }
    }, 400);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [
    snapshot,
    status.connected,
    status.calendar?.id,
    status.csrf,
    available,
    storageError,
    recovery?.error,
    db,
    retry,
  ]);

  const mutate = useCallback(
    async (path, body, method = 'POST') => {
      try {
        const result = await calendarRequest(path, { method, body, csrf: status.csrf });
        setError('');
        if (path !== 'connect') {
          setStatus(result);
          lastSent.current = '';
          setRetry((value) => value + 1);
        }
        return result;
      } catch (failure) {
        setError(failure.message);
        throw failure;
      }
    },
    [status.csrf],
  );
  return useMemo(
    () => ({
      status: {
        ...status,
        uploadPending: Boolean(
          status.connected &&
          status.calendar &&
          lastSent.current !== `${status.calendar.id}:${snapshot}`,
        ),
      },
      available,
      error,
      refresh,
      mutate,
    }),
    [status, available, error, refresh, mutate, snapshot],
  );
}
