import React, { useEffect, useRef } from 'react';
import { Button } from '../../../components/ui/Button.jsx';

/**
 * Inline confirmation; focuses Cancel and closes with Escape. Disconnect copy by default;
 * `title`, `body`, `action` and `cancel` reuse it for other lasting changes.
 */
export function ConfirmDisconnect(props) {
  const { label, t, busy, onConfirm, onCancel, title, body, action, cancel } = props;
  const confirmText = action ?? t('channels.confirmDisconnect');
  const group = useRef(null);
  useEffect(() => group.current?.querySelector('[data-cancel]')?.focus(), []);
  return (
    <div
      ref={group}
      className="channel-confirm"
      role="group"
      aria-label={confirmText}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && !busy) onCancel();
      }}
    >
      <p>
        <strong>{title ?? t('channels.disconnectPrompt', { label })}</strong>
      </p>
      <p className="channels-muted">{body ?? t('channels.disconnectBody')}</p>
      <div className="channel-actions">
        <Button variant="danger-light" disabled={busy} onClick={onConfirm}>
          {confirmText}
        </Button>
        <Button variant="light" data-cancel disabled={busy} onClick={onCancel}>
          {cancel ?? t('channels.cancel')}
        </Button>
      </div>
    </div>
  );
}
