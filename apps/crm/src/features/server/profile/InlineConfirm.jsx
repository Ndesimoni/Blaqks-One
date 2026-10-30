import React, { useEffect, useRef } from 'react';
import { Button } from '../../../components/ui/Button.jsx';

/**
 * An inline confirmation for a sign-out. Focus moves to Cancel (the safe choice) when it opens,
 * and Escape cancels.
 */
export function InlineConfirm({ label, prompt, confirmLabel, busy, onConfirm, onCancel }) {
  const group = useRef(null);
  useEffect(() => group.current?.querySelector('[data-cancel]')?.focus(), []);
  return (
    <div
      ref={group}
      className="acct-confirm"
      role="group"
      aria-label={label}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && !busy) onCancel();
      }}
    >
      <span>{prompt}</span>
      <div className="acct-actions">
        <Button
          variant="danger-light"
          className={busy ? 'acct-loading' : ''}
          disabled={busy}
          onClick={onConfirm}
        >
          {confirmLabel}
        </Button>
        <Button variant="light" data-cancel disabled={busy} onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
