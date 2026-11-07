import React from 'react';
import { useI18n } from '../../../i18n/useI18n.js';

/**
 * The quiet line under the reply box (designer spec §4): "Draft not saved · Try again" when
 * saving failed, the choice when another window changed the draft (code review M2), fill-ins
 * still to complete, then "Draft saved". Never "Saving…", so it does not flicker.
 */
export function DraftStatus({ draft, fillIns }) {
  const { t } = useI18n();
  if (draft.status === 'failed')
    return (
      <span className="draft-status is-failed" role="status">
        {t('inboxSaved.draft.failed')} ·{' '}
        <button type="button" className="draft-retry" onClick={draft.retry}>
          {t('inboxSaved.draft.retry')}
        </button>
      </span>
    );
  if (draft.status === 'changed')
    return (
      <span className="draft-status is-failed" role="status">
        {t('inboxSaved.draft.changed')} ·{' '}
        <button type="button" className="draft-retry" onClick={draft.useTheirs}>
          {t('inboxSaved.draft.useTheirs')}
        </button>{' '}
        ·{' '}
        <button type="button" className="draft-retry" onClick={draft.keepMine}>
          {t('inboxSaved.draft.keepMine')}
        </button>
      </span>
    );
  if (fillIns.length)
    return (
      <span className="draft-status">
        {t('inboxSaved.draft.fillIn', { fillIns: fillIns.join(', ') })}
      </span>
    );
  if (draft.status === 'saved')
    return (
      <span className="draft-status" role="status">
        {t('inboxSaved.draft.saved')}
      </span>
    );
  return null;
}
