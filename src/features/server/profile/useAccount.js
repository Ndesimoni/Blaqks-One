import { useCallback, useEffect, useState } from 'react';

/** Loads the caller's own account (`GET /auth/account`); `replace` installs a saved one. */
export function useAccount(api) {
  const [account, setAccount] = useState(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setError('');
    api
      .account(controller.signal)
      .then((result) => {
        if (!result?.user?.id || !Number.isInteger(result.version))
          throw Error('Your account could not be loaded. Try again.');
        if (!controller.signal.aborted) setAccount(result);
      })
      .catch((failure) => {
        if (failure.name !== 'AbortError') setError(failure.message);
      });
    return () => controller.abort();
  }, [api, attempt]);
  const reload = useCallback(() => setAttempt((value) => value + 1), []);
  return { account, error, reload, replace: setAccount };
}
