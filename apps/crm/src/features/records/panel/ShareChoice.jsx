import React, { useEffect, useId, useRef, useState } from 'react';
import { Icon } from '../../../components/ui/Icon.jsx';
import { useI18n } from '../../../i18n/useI18n.js';

/**
 * The slider header's Share (approved mockup). With one way to share it opens that dialog; with
 * a colleague and another company both possible it asks which first, as the mockup's "Share
 * with" switch does. Escape closes the choice and leaves the slider open.
 */
export function ShareChoice({ choices }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const root = useRef(null);
  const opener = useRef(null);
  const panelId = useId();
  useEffect(() => {
    if (!open) return undefined;
    const outside = (event) => !root.current?.contains(event.target) && setOpen(false);
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [open]);
  if (!choices.length) return null;
  const single = choices.length === 1;
  const choose = (choice) => {
    setOpen(false);
    opener.current?.focus();
    choice.run();
  };
  return (
    <div
      className="record-share-choice"
      ref={root}
      onKeyDown={(event) => {
        if (event.key !== 'Escape' || !open) return;
        // Cancelling the key keeps the native dialog (the slider) from closing too.
        event.preventDefault();
        event.stopPropagation();
        setOpen(false);
        opener.current?.focus();
      }}
    >
      <button
        type="button"
        ref={opener}
        className="btn btn-light"
        aria-expanded={single ? undefined : open}
        aria-controls={single ? undefined : panelId}
        disabled={choices.every((choice) => choice.disabled)}
        onClick={() => (single ? choices[0].run() : setOpen((value) => !value))}
      >
        <Icon name="users" size={16} aria-hidden="true" />
        <span>{t('recordPanel.share')}</span>
      </button>
      {open && (
        <div className="record-share-panel" id={panelId}>
          <span className="record-share-hint">{t('recordPanel.shareWith')}</span>
          {choices.map((choice) => (
            <button
              type="button"
              key={choice.label}
              disabled={choice.disabled}
              onClick={() => choose(choice)}
            >
              {choice.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
