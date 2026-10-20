import React, { useId, useState } from 'react';
import { Button } from '../../../components/ui/Button.jsx';
import { useI18n } from '../../../i18n/useI18n.js';

/** Write and send: Enter sends, Shift+Enter starts a new line. */
export function ChatComposer({ onSend }) {
  const { t } = useI18n();
  const id = useId();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const send = async (event) => {
    event.preventDefault();
    if (!text.trim() || busy) return;
    setBusy(true);
    const failure = await onSend(text.trim());
    setBusy(false);
    if (failure) setError(t('chat.composer.failed', { reason: failure }));
    else {
      setText('');
      setError('');
    }
  };
  return (
    <form className="chat-composer" onSubmit={send}>
      <label htmlFor={`${id}-text`} className="sr-only">
        {t('chat.composer.field')}
      </label>
      <textarea
        id={`${id}-text`}
        rows={2}
        maxLength={4000}
        value={text}
        placeholder={t('chat.composer.placeholder')}
        aria-describedby={`${id}-hint`}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={(event) => {
          // Phones have no Shift+Enter: there Enter adds a line and Send sends.
          if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) return;
          if (!window.matchMedia?.('(pointer: coarse)').matches) send(event);
        }}
      />
      <div className="chat-composer-actions">
        <small id={`${id}-hint`} className="chat-hint">
          {t('chat.composer.hint')}
        </small>
        <Button type="submit" icon="arrow" disabled={busy || !text.trim()}>
          {t('chat.composer.send')}
        </Button>
      </div>
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
