import React, { useId, useState } from 'react';
import { Button } from '../../../components/ui/Button.jsx';
import { useI18n } from '../../../i18n/useI18n.js';
import { canReplyOn, channelHealth } from './inboxModel.js';

/**
 * Reply or Internal note. Notes save now. Replies are honest about why they cannot be sent
 * yet: the channel is off, the member lacks the reply permission, or sending for this
 * channel arrives with its provider packet (E1 email, W1 WhatsApp).
 */
export function Composer({ conversation, user, channels, onNote }) {
  const { t } = useI18n();
  const id = useId();
  const [mode, setMode] = useState('note');
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const channelName = t(`inbox.channel.${conversation.channel}`);
  const health = channelHealth(channels, conversation.channel);
  const replyNotice =
    health === 'off'
      ? t('inbox.reply.disconnected', { channel: channelName })
      : !canReplyOn(user, conversation.channel)
        ? t('inbox.reply.noPermission', { channel: channelName })
        : t('inbox.reply.comingSoon', { channel: channelName });
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
      <div id={`${id}-panel`} role="tabpanel" aria-labelledby={`${id}-${mode}`}>
        {mode === 'reply' ? (
          <p className="inbox-reply-notice" role="status">
            {replyNotice}
          </p>
        ) : (
          <form className="inbox-note-form" onSubmit={save}>
            <label htmlFor={`${id}-text`} className="sr-only">
              {t('inbox.note.field')}
            </label>
            <textarea
              id={`${id}-text`}
              rows={2}
              maxLength={4000}
              value={text}
              placeholder={t('inbox.note.placeholder')}
              onChange={(event) => setText(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) save(event);
              }}
            />
            <div className="inbox-note-actions">
              <small>{t('inbox.note.hint')}</small>
              <Button type="submit" disabled={saving || !text.trim()}>
                {saving ? t('inbox.note.saving') : t('inbox.note.add')}
              </Button>
            </div>
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
