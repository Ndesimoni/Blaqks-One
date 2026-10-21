import React, { useId, useRef, useState } from 'react';
import { Button } from '../../../components/ui/Button.jsx';
import { useI18n } from '../../../i18n/useI18n.js';
import { ChosenFiles } from './ChosenFiles.jsx';
import { ACCEPT, useAttachments } from './useAttachments.js';

/** Write and send, with photos and files: Enter sends on desktop, adds a line on phones. */
export function ChatComposer({ api, workspaceId, onSend }) {
  const { t } = useI18n();
  const id = useId();
  const picker = useRef(null);
  const files = useAttachments(api, workspaceId);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const ready = Boolean(text.trim() || files.ids.length) && !files.busy;
  const send = async (event) => {
    event.preventDefault();
    if (!ready || busy) return;
    setBusy(true);
    const failure = await onSend(text.trim(), files.ids);
    setBusy(false);
    if (failure) setError(t('chat.composer.failed', { reason: failure }));
    else {
      setText('');
      setError('');
      files.clear();
    }
  };
  return (
    <form className="chat-composer" onSubmit={send}>
      <ChosenFiles files={files} />
      <label htmlFor={`${id}-text`} className="sr-only">
        {t('chat.composer.field')}
      </label>
      <textarea
        id={`${id}-text`}
        rows={2}
        maxLength={4000}
        value={text}
        placeholder={t('chat.composer.placeholder')}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={(event) => {
          // Phones have no Shift+Enter: there Enter adds a line and Send sends.
          if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) return;
          if (!window.matchMedia?.('(pointer: coarse)').matches) send(event);
        }}
      />
      <div className="chat-composer-actions">
        <input
          ref={picker}
          type="file"
          accept={ACCEPT}
          multiple
          hidden
          aria-label={t('chat.files.attach')}
          onChange={(event) => {
            files.add(event.target.files);
            event.target.value = '';
          }}
        />
        <Button
          variant="light"
          icon="image"
          disabled={files.full}
          onClick={() => picker.current?.click()}
        >
          {t('chat.files.attach')}
        </Button>
        <small className="chat-hint">{t('chat.composer.hint')}</small>
        <Button type="submit" icon="arrow" disabled={busy || !ready}>
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
