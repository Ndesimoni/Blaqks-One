import { useCallback, useState } from 'react';
import { BOT_TOKEN } from './signupModel.js';

/**
 * The bot-check token for start and resend. Local development sends its fixed bypass
 * token; with Turnstile there is no token until the widget is solved, so `ready` stays
 * false and the form cannot send a request the server is certain to refuse. A solved
 * token is single use, so every submit resets the widget.
 */
export function useSignupBot(status) {
  const turnstile = status?.botCheck?.provider === 'turnstile';
  const [solved, setSolved] = useState('');
  const [resetKey, setResetKey] = useState(0);
  const reset = useCallback(() => {
    if (turnstile) {
      setSolved('');
      setResetKey((current) => current + 1);
    }
  }, [turnstile]);
  return {
    token: turnstile ? solved : BOT_TOKEN,
    ready: !turnstile || Boolean(solved),
    setToken: setSolved,
    resetKey,
    reset,
  };
}
