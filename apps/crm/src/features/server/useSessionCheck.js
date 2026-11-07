import { useEffect } from 'react';

/**
 * Asks the server who is signed in when the CRM opens, and again on Retry. A 401 only means
 * signed out: it never clears a person who signed in while the check was still running.
 */
export function useSessionCheck(api, attempt, { install, setLoading, setError }) {
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    api
      .sessionWithCompany(controller.signal)
      .then(install)
      .catch((failure) => {
        if (failure.name !== 'AbortError' && failure.status !== 401) setError(failure.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
    // The setters are stable; only the client and Retry restart the check.
  }, [api, attempt]);
}
