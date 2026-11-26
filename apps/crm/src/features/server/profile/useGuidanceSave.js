import { useCallback, useRef, useState } from 'react';

/**
 * Saves the member's field-hint preference through `PUT /auth/account/guidance`.
 * `status` is idle, saving, saved or error; `pending` is the value being saved, kept
 * after a failure so Try again repeats it. A change made while saving is ignored.
 */
export function useGuidanceSave(api, onSaved) {
  const [state, setState] = useState({ status: 'idle', pending: null });
  const busy = useRef(false);
  const choose = useCallback(
    async (enabled) => {
      if (busy.current) return;
      busy.current = true;
      setState({ status: 'saving', pending: enabled });
      try {
        const account = await api.updateGuidance(enabled);
        if (!account?.user?.id || account.user.guidanceEnabled !== enabled)
          throw Error('unconfirmed');
        onSaved(account);
        setState({ status: 'saved', pending: null });
      } catch {
        setState({ status: 'error', pending: enabled });
      } finally {
        busy.current = false;
      }
    },
    [api, onSaved],
  );
  const retry = useCallback(() => {
    if (state.pending !== null) choose(state.pending);
  }, [choose, state]);
  return { ...state, choose, retry };
}
