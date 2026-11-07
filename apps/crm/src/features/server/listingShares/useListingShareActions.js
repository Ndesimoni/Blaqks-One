import { useState } from 'react';
import { useSession } from '../../../hooks/useSession.js';
import { useI18n } from '../../../i18n/useI18n.js';
import { announceListingSharesChanged } from '../waitingCounts.js';
import { readListingShareResult, readPreview } from './listingShareModel.js';

/**
 * Reviewing, sending and answering listing shares in the caller's company. Every change
 * refreshes the Agreements badge and the share lists. Results are `{ ok, share }` (or
 * `{ ok, preview }`) or `{ ok: false, message, status }` with the server's refusal, such as
 * "This listing just changed. Review it again.".
 */
export function useListingShareActions() {
  const { api, user } = useSession();
  const { t } = useI18n();
  const [busy, setBusy] = useState('');
  const workspace = user.workspaceId;
  const run = async (key, call, read, name = 'share') => {
    if (busy) return { ok: false, message: '' };
    setBusy(key);
    try {
      const value = read(await call());
      if (name === 'share') announceListingSharesChanged();
      return { ok: true, [name]: value };
    } catch (failure) {
      const message = failure.message || t('listingShareViews.failed');
      return { ok: false, message, status: failure.status || 0 };
    } finally {
      setBusy('');
    }
  };
  return {
    busy,
    preview: (recordId, exactLocation) =>
      run(
        'preview',
        () => api.previewListingShare(workspace, recordId, exactLocation),
        readPreview,
        'preview',
      ),
    send: (share) =>
      run('send', () => api.createListingShare(workspace, share), readListingShareResult),
    decide: (share, action, body) =>
      run(
        `${share.id}:${action}`,
        () => api.decideListingShare(workspace, share.id, action, body),
        readListingShareResult,
      ),
    extend: (share, viewEndsOn) =>
      run(
        `${share.id}:extend`,
        () => api.extendListingShare(workspace, share.id, viewEndsOn),
        readListingShareResult,
      ),
  };
}
