import React, { useEffect, useRef } from 'react';
import { Button } from '../../../components/ui/Button.jsx';
import { useI18n } from '../../../i18n/useI18n.js';

/** Inline disconnect confirmation; focuses the safe choice and closes with Escape. */
export function MailboxConfirm({ busy, onConfirm, onCancel }) {
  const { t } = useI18n();
  const group = useRef(null);
  useEffect(() => {
    group.current?.querySelector('[data-cancel]')?.focus();
  }, []);
  return (
    <div
      ref={group}
      className="mailbox-confirm"
      role="group"
      aria-label={t('mailbox.disconnect.title')}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && !busy) onCancel();
      }}
    >
      <p>
        <strong>{t('mailbox.disconnect.title')}</strong>
      </p>
      <p className="mailbox-muted">{t('mailbox.disconnect.body')}</p>
      <div className="mailbox-actions">
        <Button variant="danger-light" disabled={busy} onClick={onConfirm}>
          {t('mailbox.disconnect.confirm')}
        </Button>
        <Button variant="light" data-cancel disabled={busy} onClick={onCancel}>
          {t('mailbox.disconnect.cancel')}
        </Button>
      </div>
    </div>
  );
}
