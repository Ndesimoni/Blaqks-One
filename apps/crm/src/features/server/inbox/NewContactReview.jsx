import React, { useState } from 'react';
import { Button } from '../../../components/ui/Button.jsx';
import { useI18n } from '../../../i18n/useI18n.js';

/**
 * "New contact. Is this a lead?" (design DesktopTriage): why a lead is or is not suggested,
 * and the four decisions. Blocking asks once more, because the sender's later messages are
 * dropped without anyone seeing them.
 */
export function NewContactReview({ row, user, busy, onOpenPanel, onAct }) {
  const { t } = useI18n();
  const [confirming, setConfirming] = useState(false);
  const mayBlock = user.roleId === 'admin' || row.assigneeId === user.id;
  const reason =
    row.match === 'choice'
      ? 'inboxTriage.review.choice'
      : row.suggestedLead
        ? 'inboxTriage.review.suggested'
        : 'inboxTriage.review.unknown';
  return (
    <section className="inbox-review" aria-label={t('inboxTriage.review.label')}>
      <div className="inbox-review-text">
        <strong>{t('inboxTriage.review.title')}</strong>
        <span>{t(reason)}</span>
      </div>
      {confirming ? (
        <div
          className="inbox-review-actions"
          role="group"
          aria-label={t('inboxTriage.block.confirmLabel')}
        >
          <span className="inbox-review-warning">{t('inboxTriage.block.warning')}</span>
          <Button variant="danger-light" disabled={busy} onClick={() => onAct('block')}>
            {t('inboxTriage.block.confirm')}
          </Button>
          <Button variant="light" disabled={busy} onClick={() => setConfirming(false)}>
            {t('inboxTriage.cancel')}
          </Button>
        </div>
      ) : (
        <div className="inbox-review-actions">
          <Button disabled={busy} onClick={() => onOpenPanel('lead')}>
            {t('inboxTriage.review.createLead')}
          </Button>
          <Button variant="light" disabled={busy} onClick={() => onOpenPanel('link')}>
            {t('inboxTriage.review.link')}
          </Button>
          {row.state !== 'resolved' && (
            <Button variant="light" disabled={busy} onClick={() => onAct('resolve')}>
              {t('inboxTriage.review.notLead')}
            </Button>
          )}
          {mayBlock && (
            <Button
              variant="danger-light"
              className="inbox-review-block"
              disabled={busy}
              onClick={() => setConfirming(true)}
            >
              {t('inboxTriage.block.open')}
            </Button>
          )}
        </div>
      )}
    </section>
  );
}

/** A blocked sender's conversation: what blocking means, and the Admin's way back. */
export function BlockedNotice({ user, busy, onAct }) {
  const { t } = useI18n();
  return (
    <section className="inbox-review is-blocked" aria-label={t('inboxTriage.block.blockedLabel')}>
      <div className="inbox-review-text">
        <strong>{t('inboxTriage.block.blockedTitle')}</strong>
        <span>{t('inboxTriage.block.blockedBody')}</span>
      </div>
      {user.roleId === 'admin' && (
        <div className="inbox-review-actions">
          <Button variant="light" disabled={busy} onClick={() => onAct('unblock')}>
            {t('inboxTriage.block.unblock')}
          </Button>
        </div>
      )}
    </section>
  );
}
