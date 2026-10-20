import React, { useState } from 'react';
import { Button } from '../../../components/ui/Button.jsx';
import { useNavigation } from '../../../hooks/useWorkspace.js';
import { useI18n } from '../../../i18n/useI18n.js';

/** Why this member cannot reply here, with the way to fix it when there is one. */
function ReplyNotice({ state, channel }) {
  const { t } = useI18n();
  const { navigate } = useNavigation();
  const channelName = t(`inbox.channel.${channel}`);
  const own = ['connectMailbox', 'reconnect', 'otherMailbox', 'notSendable'].includes(state);
  return (
    <div className="inbox-reply-notice" role="status">
      <span>
        {own ? t(`inboxSend.reply.${state}`) : t(`inbox.reply.${state}`, { channel: channelName })}
      </span>
      {['connectMailbox', 'reconnect'].includes(state) && (
        <Button variant="light" onClick={() => navigate('My mailbox')}>
          {t('inboxSend.reply.openMailbox')}
        </Button>
      )}
    </div>
  );
}

/**
 * The Reply tab (E1d): an email form when the member may send from this conversation's
 * mailbox (O9), otherwise an honest notice. Sending queues the message; the thread shows
 * Sending… until the worker settles it.
 */
export function ReplyPanel({ id, state, conversation, mailbox, onReply }) {
  const { t } = useI18n();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  if (state !== 'send') return <ReplyNotice state={state} channel={conversation.channel} />;
  const send = async (event) => {
    event.preventDefault();
    if (!text.trim() || busy) return;
    setBusy(true);
    const failure = await onReply(text.trim());
    setBusy(false);
    if (failure) setError(t('inboxSend.reply.failed', { reason: failure }));
    else {
      setText('');
      setError('');
    }
  };
  return (
    <form id={`${id}-reply`} className="inbox-reply-form" onSubmit={send}>
      <label htmlFor={`${id}-reply-text`} className="sr-only">
        {t('inboxSend.reply.field')}
      </label>
      <textarea
        id={`${id}-reply-text`}
        rows={2}
        maxLength={20000}
        value={text}
        placeholder={t('inboxSend.reply.placeholder')}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) send(event);
        }}
      />
      <div className="inbox-reply-actions">
        <small>
          {t('inboxSend.reply.hint', { mailbox: '' })}
          <bdi>{mailbox.label}</bdi>
        </small>
        <Button type="submit" icon="arrow" disabled={busy || !text.trim()}>
          {busy ? t('inboxSend.reply.sending') : t('inboxSend.reply.send')}
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
