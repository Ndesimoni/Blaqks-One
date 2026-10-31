import { useEffect, useState } from 'react';

export function useSignupStatus(api) {
  const [state, setState] = useState({ loading: true, value: null, error: '' });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setState({ loading: true, value: null, error: '' });
    api
      .signupStatus(controller.signal)
      .then((value) => setState({ loading: false, value, error: '' }))
      .catch((error) => {
        if (error.name !== 'AbortError')
          setState({ loading: false, value: null, error: error.message });
      });
    return () => controller.abort();
  }, [api, attempt]);
  return { ...state, retry: () => setAttempt((value) => value + 1) };
}
