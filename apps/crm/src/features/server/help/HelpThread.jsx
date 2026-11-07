import React, { useId, useState } from 'react';
import { Badge } from '../../../components/ui/Badge.jsx';
import { Button } from '../../../components/ui/Button.jsx';
import { useI18n } from '../../../i18n/useI18n.js';
import { STATE_TONES } from './helpModel.js';

/**
 * A help request's conversation for either side (`side` is 'member' or 'platform'): the
 * subject and state, `children` (the requester card and actions), the messages oldest first,
 * and a reply box when `canReply`. On phones `onBack` returns to the list.
 */
export function HelpThread({
  thread,
  side,
  busy,
  error,
  canReply,
  onReply,
  replyLabel,
  onBack,
  children,
}) {
  const { t, format } = useI18n();
  const k = (key, vars) => t(`help.${key}`, vars);
  const replyId = useId();
  const [text, setText] = useState('');
  const { request, messages } = thread;
  const author = (message) =>
    message.side === 'platform'
      ? `${k('blaqksOne')} · ${message.authorName || ''}`
      : message.side === side
        ? k('you')
        : message.authorName;
  const submit = async (event) => {
    event.preventDefault();
    if (text.trim() && (await onReply(text.trim()))) setText('');
  };
  return (
    <section className="help-thread" aria-label={k('thread')}>
      <header className="help-thread-head">
        {onBack && (
          <Button variant="light" icon="arrow" className="help-back" onClick={onBack}>
            {k('back')}
          </Button>
        )}
        <h2>{request.subject}</h2>
        <span>
          {k(`category.${request.category}`)} ·{' '}
          <Badge tone={STATE_TONES[request.state]}>{k(`state.${request.state}`)}</Badge>
        </span>
        {children}
      </header>
      <ol className="help-messages">
        {messages.map((message) => (
          <li
            key={message.id}
            className={'help-message' + (message.side === side ? ' is-mine' : '')}
          >
            <span className="help-message-who">
              {author(message)} · {format.dateTime(message.at)}
            </span>
            <p>{message.body}</p>
          </li>
        ))}
      </ol>
      {request.state === 'solved' && side === 'member' && (
        <p className="help-note">{k('solvedNote')}</p>
      )}
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
      {canReply && (
        <form className="help-reply" onSubmit={submit}>
          <div className="field">
            <label htmlFor={replyId} className="sr-only">
              {replyLabel}
            </label>
            <textarea
              id={replyId}
              rows={3}
              value={text}
              placeholder={replyLabel}
              disabled={busy}
              onChange={(event) => setText(event.target.value)}
            />
          </div>
          <Button type="submit" icon="arrow" disabled={busy || !text.trim()}>
            {side === 'member' ? k('sendReply') : k('sendAnswer')}
          </Button>
        </form>
      )}
    </section>
  );
}
