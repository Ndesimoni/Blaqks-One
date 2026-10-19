import { useCallback, useState } from 'react';
import { BOT_TOKEN } from './signupModel.js';

// A solved Turnstile token is single-use, so every submit resets the widget.
export function useSignupBot(status) {
  const [token, setToken] = useState(BOT_TOKEN);
  const [resetKey, setResetKey] = useState(0);
  const reset = useCallback(() => {
    if (status?.botCheck?.provider === 'turnstile') {
      setToken('');
      setResetKey((current) => current + 1);
    }
  }, [status]);
  return { token, setToken, resetKey, reset };
}
