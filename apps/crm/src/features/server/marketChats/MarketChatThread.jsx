import React, { useEffect, useId, useState } from 'react';
import { Button } from '../../../components/ui/Button.jsx';
import { Icon } from '../../../components/ui/Icon.jsx';
import { useSession } from '../../../hooks/useSession.js';
import { useI18n } from '../../../i18n/useI18n.js';
import { ComposerBox } from '../composer/ComposerBox.jsx';
import { requestTitle } from '../marketplace/requestText.js';
import { useBrokerThread } from './useBrokerThread.js';

/**
 * The open broker chat as the approved mockup draws it (Team chat's frame): the broker and the
 * request, the privacy note, bubbles and a one-line composer. Plain text only; a closed
 * request keeps its history read-only. `onDirty` and `onBusy` let the page guard a switch.
 */
export function MarketChatThread({ chat, onBack, onSent, onDirty, onBusy }) {
  const { api, user } = useSession();
  const { t, format } = useI18n();
  const k = (key, vars) => t(`marketChats.${key}`, vars);
  const id = useId();
  const thread = useBrokerThread(chat.id);
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => onDirty?.(Boolean(body.trim())), [body, onDirty]);
  useEffect(() => onBusy?.(busy), [busy, onBusy]);
  const send = async (event) => {
    event.preventDefault();
    if (busy || !chat.canReply || !body.trim()) return;
    setBusy(true);
    setError('');
    try {
      await api.sendMarketplaceMessage(user.workspaceId, chat.id, body.trim());
      setBody('');
      thread.reload();
      onSent?.();
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <header className="chat-room-head">
        <Button
          variant="light"
          icon="arrow"
          className="chat-back"
          aria-label={k('back')}
          onClick={onBack}
        />
        <div className="chat-room-title">
          <h2>
            <bdi>{chat.participantName}</bdi>
          </h2>
          <p>
            <Icon name="lock" size={14} />
            {k(chat.mine ? 'yourRequest' : 'theirRequest', {
              request: requestTitle(t, chat.request),
            })}
          </p>
        </div>
      </header>
      <p className="market-chat-window">{k('privacy')}</p>
      <div className="chat-thread" tabIndex={0} aria-label={chat.participantName}>
        {thread.messages === null && !thread.error && <p role="status">{k('loadingThread')}</p>}
        {thread.error && (
          <p className="field-error" role="alert">
            {thread.error}
          </p>
        )}
        <ol className="chat-messages" aria-live="polite">
          {(thread.messages || []).map((message) => {
            const mine = message.authorId === user.id;
            return (
              <li key={message.id} className={'chat-message' + (mine ? ' is-mine' : '')}>
                <div className="chat-message-head">
                  <strong>{mine ? k('you') : chat.participantName}</strong>
                  <time dateTime={message.createdAt}>{format.dateTime(message.createdAt)}</time>
                </div>
                <p className="chat-body">{message.body}</p>
              </li>
            );
          })}
        </ol>
      </div>
      {chat.canReply ? (
        <form className="chat-composer" onSubmit={send}>
          <label htmlFor={`${id}-text`} className="sr-only">
            {k('message')}
          </label>
          <ComposerBox
            files={null}
            action={
              <Button type="submit" icon="arrow" disabled={busy || !body.trim()}>
                {k('send')}
              </Button>
            }
          >
            <textarea
              id={`${id}-text`}
              className="composer-input"
              rows={1}
              maxLength={2000}
              value={body}
              placeholder={k('placeholder', { name: chat.participantName })}
              disabled={busy}
              onChange={(event) => setBody(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) send(event);
              }}
            />
          </ComposerBox>
          {error && (
            <p className="field-error" role="alert">
              {error}
            </p>
          )}
        </form>
      ) : (
        <p className="market-chat-readonly" role="status">
          {k('readOnly')}
        </p>
      )}
    </>
  );
}
