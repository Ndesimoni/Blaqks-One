import { useContext, useState } from 'react';
import { WorkspaceScopeContext } from '../../../app/WorkspaceScopeContext.js';
import { useSession } from '../../../hooks/useSession.js';
import { useI18n } from '../../../i18n/useI18n.js';
import { announceSharesChanged } from '../waitingCounts.js';
import { readShareResult } from './shareModel.js';

/**
 * Sending and answering shares in the selected workspace. Every change refreshes the share
 * badges and panels; accepting also reloads the record list (`refreshRecords`) so the
 * view-only copy appears with its badge. Results are `{ ok, share }` or `{ ok, message }`
 * with the server's refusal, such as "This share action is no longer available.".
 */
export function useShareActions(refreshRecords) {
  const { api } = useSession();
  const { owner } = useContext(WorkspaceScopeContext);
  const { t } = useI18n();
  const [busy, setBusy] = useState('');
  const run = async (key, call, accepted = false) => {
    if (busy) return { ok: false, message: '' };
    setBusy(key);
    try {
      const share = readShareResult(await call());
      announceSharesChanged();
      if (accepted) await refreshRecords?.().catch(() => {});
      return { ok: true, share };
    } catch (failure) {
      announceSharesChanged();
      return { ok: false, message: failure.message || t('recordShares.failed') };
    } finally {
      setBusy('');
    }
  };
  return {
    busy,
    send: (collection, recordId, toId) =>
      run('send', () => api.createShare(owner.id, collection, recordId, toId)),
    decide: (share, action) =>
      run(share.id, () => api.decideShare(owner.id, share.id, action), action === 'accept'),
  };
}
