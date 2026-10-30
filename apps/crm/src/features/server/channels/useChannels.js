import { useCallback, useEffect, useState } from 'react';

/** Loads the effective workspace's channel connections and refreshes after a change. */
export function useChannels(api, workspaceId) {
  const [channels, setChannels] = useState(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [notice, setNotice] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    setError('');
    api
      .channels(workspaceId, controller.signal)
      .then((result) => {
        if (!Array.isArray(result.channels))
          throw Error('The server returned incomplete channels.');
        if (!controller.signal.aborted) setChannels(result.channels);
      })
      .catch((failure) => {
        if (failure.name !== 'AbortError') setError(failure.message);
      });
    return () => controller.abort();
  }, [api, workspaceId, attempt]);
  const reload = useCallback(() => setAttempt((value) => value + 1), []);
  return { channels, error, reload, notice, setNotice };
}
