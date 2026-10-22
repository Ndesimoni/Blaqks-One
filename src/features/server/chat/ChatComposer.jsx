import React, { useId, useRef, useState } from 'react';
import { Button } from '../../../components/ui/Button.jsx';
import { useI18n } from '../../../i18n/useI18n.js';
import { ComposerBox } from '../composer/ComposerBox.jsx';
import { MentionList } from './MentionList.jsx';
import { useAttachments } from './useAttachments.js';
import { useMentions } from './useMentions.js';

/**
 * Write and send, with photos and files: Enter sends on desktop, adds a line on phones.
 * In channels and groups, `@` suggests the colleagues in `people` to mention (packet C3).
 */
export function ChatComposer({ api, workspaceId, onSend, people = [] }) {
  const { t } = useI18n();
  const id = useId();
  const field = useRef(null);
  const files = useAttachments(api, workspaceId);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const mentions = useMentions(people, text, setText, field);
  const listId = `${id}-mentions`;
  const ready = Boolean(text.trim() || files.ids.length) && !files.busy;
  const send = async (event) => {
    event.preventDefault();
    if (!ready || busy) return;
    setBusy(true);
    const failure = await onSend(text.trim(), files.ids, mentions.ids());
    setBusy(false);
    if (failure) setError(t('chat.composer.failed', { reason: failure }));
    else {
      setText('');
      setError('');
      files.clear();
      mentions.reset();
    }
  };
  const track = (event) => mentions.track(event.target.value, event.target.selectionStart);
  return (
    <form className="chat-composer" onSubmit={send}>
      <MentionList id={listId} mentions={mentions} />
      <label htmlFor={`${id}-text`} className="sr-only">
        {t('chat.composer.field')}
      </label>
      <ComposerBox
        files={files}
        meta={<small className="chat-hint">{t('chat.composer.hint')}</small>}
        action={
          <Button type="submit" icon="arrow" disabled={busy || !ready}>
            {t('chat.composer.send')}
          </Button>
        }
      >
        <textarea
          ref={field}
          id={`${id}-text`}
          className="composer-input"
          rows={1}
          maxLength={4000}
          value={text}
          placeholder={t(people.length ? 'chat.composer.mention' : 'chat.composer.placeholder')}
          aria-autocomplete={people.length ? 'list' : undefined}
          aria-controls={mentions.open ? listId : undefined}
          aria-activedescendant={mentions.open ? `${listId}-${mentions.active}` : undefined}
          onChange={(event) => {
            setText(event.target.value);
            track(event);
          }}
          onSelect={track}
          onBlur={mentions.close}
          onKeyDown={(event) => {
            if (event.nativeEvent.isComposing || mentions.onKeyDown(event)) return;
            // Phones have no Shift+Enter: there Enter adds a line and Send sends.
            if (event.key !== 'Enter' || event.shiftKey) return;
            if (!window.matchMedia?.('(pointer: coarse)').matches) send(event);
          }}
        />
      </ComposerBox>
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
