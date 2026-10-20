import { useCallback, useEffect, useState } from 'react';

const SOURCES = ['ad', 'listing', 'form', 'portal'];

/** Arabic script anywhere in a word places it in the Arabic list. */
export const isArabic = (word) => /[؀-ۿ]/.test(word);

/** A word list with `word` added once (lower case, trimmed); unchanged when invalid. */
export function addWord(list, word) {
  const clean = String(word || '')
    .trim()
    .toLowerCase();
  if (!clean || clean.length > 60 || list.includes(clean) || list.length >= 100) return list;
  return [...list, clean];
}

/** The saved rules as an editable draft, and back to the API's shape. */
export const toDraft = (rules) => ({
  automatic: rules.autoSources.length > 0,
  leadMode: rules.leadMode,
  wordsEn: rules.wordsEn,
  wordsAr: rules.wordsAr,
});
export const toBody = (draft, version) => ({
  expectedVersion: version,
  leadMode: draft.leadMode,
  autoSources: draft.automatic ? SOURCES : [],
  wordsEn: draft.wordsEn,
  wordsAr: draft.wordsAr,
});

/** Loads the company's lead rules and saves a draft with its version. */
export function useInboxRules(api, workspaceId) {
  const [state, setState] = useState({ status: 'loading', rules: null });
  const load = useCallback(
    (signal) =>
      api
        .inboxRules(workspaceId, signal)
        .then((value) => setState({ status: 'ready', rules: value.rules }))
        .catch((failure) => {
          if (failure.name !== 'AbortError') setState({ status: 'error', rules: null });
        }),
    [api, workspaceId],
  );
  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [load]);
  /** Saves; returns '' on success, 'stale' when someone saved first, else 'failed'. */
  const save = async (draft) => {
    try {
      const value = await api.saveInboxRules(workspaceId, toBody(draft, state.rules.version));
      setState({ status: 'ready', rules: value.rules });
      return '';
    } catch (failure) {
      if (failure.status === 409) {
        load();
        return 'stale';
      }
      return 'failed';
    }
  };
  return { ...state, save, reload: () => load() };
}
