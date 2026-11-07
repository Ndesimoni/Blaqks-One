import { useCallback, useRef, useState } from 'react';

/**
 * Saves the member's language through `PUT /auth/account/language`. `status` is idle,
 * saving, saved or error; `pending` is the language being saved (kept after a failure so
 * Try again repeats it). A choice made while saving is ignored.
 */
export function useLanguageSave(api, onSaved) {
  const [state, setState] = useState({ status: 'idle', pending: null });
  const busy = useRef(false);
  const choose = useCallback(
    async (language) => {
      if (busy.current) return;
      busy.current = true;
      setState({ status: 'saving', pending: language });
      try {
        const account = await api.updateLanguage(language);
        if (!account?.user?.id || account.user.language !== language) throw Error('unconfirmed');
        onSaved(account);
        setState({ status: 'saved', pending: null });
      } catch {
        setState({ status: 'error', pending: language });
      } finally {
        busy.current = false;
      }
    },
    [api, onSaved],
  );
  const retry = useCallback(() => state.pending && choose(state.pending), [choose, state]);
  return { ...state, choose, retry };
}
