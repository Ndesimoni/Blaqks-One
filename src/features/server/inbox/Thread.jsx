import React, { useEffect, useRef } from 'react';
import { useI18n } from '../../../i18n/useI18n.js';
import { canSendAgain } from './composerModel.js';
import { threadGroups } from './inboxModel.js';
import { MessageAgain } from './MessageAgain.jsx';

/** Status words a message may show; email never claims Read (design States artboard). */
function statusText(t, message, channel) {
  if (message.direction === 'inbound') return '';
  if (message.status === 'read' && channel === 'email') return t('inbox.message.delivered');
  if (message.status === 'sending') return t('inboxSend.message.sending');
  return t(`inbox.message.${message.status}`);
}

function Message({ message, channel, t, format, again, onAgain }) {
  const outbound = message.direction === 'outbound';
  const status = statusText(t, message, channel);
  return (
    <li className={'inbox-message' + (outbound ? ' is-outbound' : ' is-inbound')}>
      <div className={'inbox-bubble' + (message.status === 'failed' ? ' is-failed' : '')}>
        {message.body || (message.hasMedia ? t('inbox.message.media') : '')}
        {message.body && message.hasMedia && (
          <em className="inbox-media">{t('inbox.message.media')}</em>
        )}
      </div>
      <span className="inbox-message-meta">
        <time dateTime={message.at}>{format.time(message.at)}</time>
        {status && <span> · {status}</span>}
      </span>
      {again && <MessageAgain message={message} onAgain={onAgain} />}
    </li>
  );
}

/** Internal notes look nothing like a sent message and say who can see them. */
function Note({ note, author, t, format }) {
  return (
    <li className="inbox-note">
      <span className="inbox-note-label">{t('inbox.note.label')}</span>
      <span className="inbox-note-body">{note.body}</span>
      <span className="inbox-note-meta">
        {author} · <time dateTime={note.at}>{format.time(note.at)}</time>
      </span>
    </li>
  );
}

/**
 * Messages and internal notes by Dubai day, scrolled to the newest. New inbound messages
 * are announced politely to screen readers.
 */
export function Thread({ data, nameOf, userId, onAgain }) {
  const { t, format } = useI18n();
  const box = useRef(null);
  const groups = threadGroups(data.messages, data.notes);
  const latest = data.messages.at(-1);
  // Scroll only the thread to its newest item, never the page around it.
  useEffect(() => {
    const thread = box.current;
    if (!thread) return;
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    thread.scrollTo?.({ top: thread.scrollHeight, behavior: reduced ? 'auto' : 'smooth' });
  }, [data.messages.length, data.notes.length]);
  const channel = data.conversation.channel;
  return (
    <div ref={box} className="inbox-thread" tabIndex={0} aria-label={t('inbox.thread.label')}>
      {groups.map((group) => (
        <section key={group.day} aria-label={format.date(group.day, { dateStyle: 'full' })}>
          <div className="inbox-day">{format.date(group.day, { dateStyle: 'medium' })}</div>
          <ol className="inbox-items">
            {group.items.map((item) =>
              item.kind === 'note' ? (
                <Note
                  key={item.id}
                  note={item}
                  author={nameOf(item.authorId)}
                  t={t}
                  format={format}
                />
              ) : (
                <Message
                  key={item.id}
                  message={item}
                  channel={channel}
                  t={t}
                  format={format}
                  again={canSendAgain(item, data.messages, userId)}
                  onAgain={onAgain}
                />
              ),
            )}
          </ol>
        </section>
      ))}
      <p className="sr-only" aria-live="polite">
        {latest?.direction === 'inbound' ? t('inbox.thread.latest', { text: latest.body }) : ''}
      </p>
    </div>
  );
}
