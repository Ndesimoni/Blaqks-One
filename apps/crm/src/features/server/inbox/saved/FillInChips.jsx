import React from 'react';
import { useI18n } from '../../../../i18n/useI18n.js';

const FILL_INS = ['{client name}', '{my name}', '{company}'];

/** Buttons that put a fill-in at the cursor in a saved reply's text (designer spec §3). */
export function FillInChips({ textRef, body, setBody, hintId }) {
  const { t } = useI18n();
  const insert = (token) => {
    const area = textRef.current;
    const [start, end] = [area?.selectionStart ?? body.length, area?.selectionEnd ?? body.length];
    const next = body.slice(0, start) + token + body.slice(end);
    if (next.length > 5000) return;
    setBody(next);
    requestAnimationFrame(() => {
      area?.focus();
      area?.setSelectionRange(start + token.length, start + token.length);
    });
  };
  return (
    <div className="saved-form-fillins">
      <div className="saved-form-chips">
        {FILL_INS.map((token) => (
          <button
            key={token}
            type="button"
            className="saved-form-chip"
            aria-label={t('inboxSaved.form.insert', { fillIn: token })}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => insert(token)}
          >
            {token}
          </button>
        ))}
      </div>
      <small id={hintId}>{t('inboxSaved.form.fillInsHint')}</small>
    </div>
  );
}
