import { useCallback, useState } from 'react';
import { useSession } from '../../../../hooks/useSession.js';
import { useWorkspaceScope } from '../../../../hooks/useWorkspaceScope.js';

/**
 * The company's and the member's saved replies (docs/saved-replies-drafts.md §4), loaded
 * when first needed. Each change answers `null` or the server's error, then reloads.
 */
export function useSavedReplies() {
  const { api } = useSession();
  const { owner } = useWorkspaceScope();
  const [state, setState] = useState({ data: null, error: '', loading: false });
  const load = useCallback(async () => {
    setState((current) => ({ ...current, loading: true, error: '' }));
    try {
      const data = await api.savedReplies(owner.id);
      setState({ data, error: '', loading: false });
    } catch (failure) {
      setState((current) => ({ ...current, loading: false, error: failure.message || 'error' }));
    }
  }, [api, owner.id]);
  const change = async (call) => {
    try {
      await call();
      await load();
      return null;
    } catch (failure) {
      return failure;
    }
  };
  return {
    ...state,
    load,
    add: (scope, title, body) => change(() => api.addSavedReply(owner.id, { scope, title, body })),
    edit: (item, title, body) =>
      change(() =>
        api.editSavedReply(owner.id, item.id, { expectedVersion: item.version, title, body }),
      ),
    remove: (item) => change(() => api.removeSavedReply(owner.id, item.id, item.version)),
  };
}
