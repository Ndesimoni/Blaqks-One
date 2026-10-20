import React, { useEffect, useRef } from 'react';
import { Button } from '../../../components/ui/Button.jsx';

/** Inline disconnect confirmation; focuses Cancel and closes with Escape. */
export function ConfirmDisconnect({ label, t, busy, onConfirm, onCancel }) {
  const group = useRef(null);
  useEffect(() => group.current?.querySelector('[data-cancel]')?.focus(), []);
  return (
    <div
      ref={group}
      className="channel-confirm"
      role="group"
      aria-label={t('channels.confirmDisconnect')}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && !busy) onCancel();
      }}
    >
      <p>
        <strong>{t('channels.disconnectPrompt', { label })}</strong>
      </p>
      <p className="channels-muted">{t('channels.disconnectBody')}</p>
      <div className="channel-actions">
        <Button variant="danger-light" disabled={busy} onClick={onConfirm}>
          {t('channels.confirmDisconnect')}
        </Button>
        <Button variant="light" data-cancel disabled={busy} onClick={onCancel}>
          {t('channels.cancel')}
        </Button>
      </div>
    </div>
  );
}
