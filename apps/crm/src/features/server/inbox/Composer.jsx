import React, { useEffect, useId, useState } from 'react';
import { Button } from '../../../components/ui/Button.jsx';
import { useI18n } from '../../../i18n/useI18n.js';
import { ComposerBox } from '../composer/ComposerBox.jsx';
import { replyState } from './composerModel.js';
import { channelHealth } from './inboxModel.js';
import { ReplyPanel } from './ReplyPanel.jsx';

/**
 * Reply, Internal note and, as the mockup's third tab, Saved replies (the reply form puts its
 * picker button in the tab row; choosing a reply opens Reply). Notes save now. Email replies send from the member's own
 * mailbox (E1d) and WhatsApp from the member's own number (W1b, `whatsapp` holds its actions
 * and the team for names); otherwise the Reply tab says why not.
 */
export function Composer({ conversation, user, channels, mailbox, onNote, onReply, whatsapp }) {
  const { t } = useI18n();
  const id = useId();
  const health = channelHealth(channels, conversation.channel);
  const state = replyState({ conversation, user, mailbox, health });
  const sendable = state === 'send' || (state === 'whatsapp' && conversation.whatsapp.canSend);
  const [mode, setMode] = useState(sendable ? 'reply' : 'note');
  const [chosen, setChosen] = useState(false);
  const [slot, setSlot] = useState(null);
  // The mailbox loads after the first render: open on Reply once sending is possible, unless
  // the member already picked a tab, so a reload shows their draft (N2).
  useEffect(() => {
    if (!chosen && sendable) setMode('reply');
  }, [chosen, sendable]);
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const save = async (event) => {
    event.preventDefault();
    if (!text.trim() || saving) return;
    setSaving(true);
    const failure = await onNote(text.trim());
    setSaving(false);
    if (failure) setError(t('inbox.note.failed'));
    else {
      setText('');
      setError('');
    }
  };
  return (
    <div className="inbox-composer">
      <div className="inbox-composer-top">
        <div role="tablist" aria-label={t('inbox.composer.mode')} className="inbox-composer-tabs">
          {['reply', 'note'].map((name) => (
            <button
              key={name}
              type="button"
              role="tab"
              id={`${id}-${name}`}
              aria-selected={mode === name}
              aria-controls={`${id}-panel`}
              className={
                'inbox-composer-tab' +
                (mode === name ? ' is-active' : '') +
                (name === 'note' ? ' is-note' : '')
              }
              onClick={() => {
                setChosen(true);
                setMode(name);
              }}
            >
              {t(`inbox.composer.${name}`)}
            </button>
          ))}
        </div>
        <span ref={setSlot} className="inbox-composer-slot" />
        {/* The note's action sits on the tab row so the thread keeps its height. */}
        {mode === 'note' && (
          <div className="inbox-note-actions">
            <small>{t('inbox.note.hint')}</small>
            <Button type="submit" form={`${id}-form`} disabled={saving || !text.trim()}>
              {saving ? t('inbox.note.saving') : t('inbox.note.add')}
            </Button>
          </div>
        )}
      </div>
      <div id={`${id}-panel`} role="tabpanel" aria-labelledby={`${id}-${mode}`}>
        {/* Kept while a note is open, so its draft stays and Saved replies stays in the row. */}
        <div hidden={mode !== 'reply'}>
          <ReplyPanel
            id={id}
            state={state}
            conversation={conversation}
            mailbox={mailbox}
            toolSlot={slot}
            onPicked={() => {
              setChosen(true);
              setMode('reply');
            }}
            onReply={onReply}
            whatsapp={{ ...whatsapp, user }}
          />
        </div>
        {mode === 'note' && (
          <form id={`${id}-form`} className="inbox-note-form" onSubmit={save}>
            <label htmlFor={`${id}-text`} className="sr-only">
              {t('inbox.note.field')}
            </label>
            <ComposerBox className="is-note">
              <textarea
                id={`${id}-text`}
                className="composer-input"
                rows={1}
                maxLength={4000}
                value={text}
                placeholder={t('inbox.note.placeholder')}
                onChange={(event) => setText(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) save(event);
                }}
              />
            </ComposerBox>
            {error && (
              <p className="field-error" role="alert">
                {error}
              </p>
            )}
          </form>
        )}
      </div>
    </div>
  );
}
