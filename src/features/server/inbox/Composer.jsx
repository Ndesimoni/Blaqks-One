import React, { useId, useState } from 'react';
import { Button } from '../../../components/ui/Button.jsx';
import { useI18n } from '../../../i18n/useI18n.js';
import { replyState } from './composerModel.js';
import { channelHealth } from './inboxModel.js';
import { ReplyPanel } from './ReplyPanel.jsx';

/**
 * Reply or Internal note. Notes save now. Email replies send from the member's own
 * mailbox (E1d); otherwise the Reply tab says why not: the channel is off, the member lacks
 * the permission or a mailbox, or sending for this channel arrives with its packet (W1).
 */
export function Composer({ conversation, user, channels, mailbox, onNote, onReply }) {
  const { t } = useI18n();
  const id = useId();
  const health = channelHealth(channels, conversation.channel);
  const state = replyState({ conversation, user, mailbox, health });
  const [mode, setMode] = useState(state === 'send' ? 'reply' : 'note');
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
              onClick={() => setMode(name)}
            >
              {t(`inbox.composer.${name}`)}
            </button>
          ))}
        </div>
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
        {mode === 'reply' ? (
          <ReplyPanel
            id={id}
            state={state}
            conversation={conversation}
            mailbox={mailbox}
            onReply={onReply}
          />
        ) : (
          <form id={`${id}-form`} className="inbox-note-form" onSubmit={save}>
            <label htmlFor={`${id}-text`} className="sr-only">
              {t('inbox.note.field')}
            </label>
            <textarea
              id={`${id}-text`}
              rows={1}
              maxLength={4000}
              value={text}
              placeholder={t('inbox.note.placeholder')}
              onChange={(event) => setText(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) save(event);
              }}
            />
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
