import React, { useState } from 'react';
import { Button } from '../../../components/ui/Button.jsx';
import { useSession } from '../../../hooks/useSession.js';
import { useNavigation } from '../../../hooks/useWorkspace.js';
import { useWorkspaceScope } from '../../../hooks/useWorkspaceScope.js';
import { useI18n } from '../../../i18n/useI18n.js';
import { useAttachments } from '../chat/useAttachments.js';
import { ComposerBox } from '../composer/ComposerBox.jsx';

/** Why this member cannot reply here, with the way to fix it when there is one. */
function ReplyNotice({ state, channel }) {
  const { t } = useI18n();
  const { navigate } = useNavigation();
  const channelName = t(`inbox.channel.${channel}`);
  const own = [
    'connectMailbox',
    'reconnect',
    'needAddress',
    'adminNeedsAddress',
    'companyReconnect',
    'otherMailbox',
    'notSendable',
  ].includes(state);
  return (
    <div className="inbox-reply-notice" role="status">
      <span>
        {own ? t(`inboxSend.reply.${state}`) : t(`inbox.reply.${state}`, { channel: channelName })}
      </span>
      {state === 'adminNeedsAddress' && (
        <Button variant="light" onClick={() => navigate('Channels')}>
          {t('inboxSend.reply.openChannels')}
        </Button>
      )}
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
  const { api } = useSession();
  const { owner } = useWorkspaceScope();
  const files = useAttachments(api, owner.id);
  if (state !== 'send') return <ReplyNotice state={state} channel={conversation.channel} />;
  const send = async (event) => {
    event.preventDefault();
    if (!text.trim() || busy) return;
    setBusy(true);
    const failure = await onReply(text.trim(), files.ids);
    setBusy(false);
    if (failure) setError(t('inboxSend.reply.failed', { reason: failure }));
    else {
      setText('');
      setError('');
      files.clear();
    }
  };
  return (
    <form id={`${id}-reply`} className="inbox-reply-form" onSubmit={send}>
      <label htmlFor={`${id}-reply-text`} className="sr-only">
        {t('inboxSend.reply.field')}
      </label>
      {/* Attachments go through company email only (F3a). */}
      <ComposerBox
        files={mailbox.company ? files : null}
        attachDisabled={busy}
        meta={
          <small>
            {t('inboxSend.reply.hint', { mailbox: '' })}
            <bdi>{mailbox.label}</bdi>
          </small>
        }
        action={
          <Button type="submit" icon="arrow" disabled={busy || files.busy || !text.trim()}>
            {busy ? t('inboxSend.reply.sending') : t('inboxSend.reply.send')}
          </Button>
        }
      >
        <textarea
          id={`${id}-reply-text`}
          className="composer-input"
          rows={2}
          maxLength={20000}
          value={text}
          placeholder={t('inboxSend.reply.placeholder')}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) send(event);
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
