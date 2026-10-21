import React, { useRef } from 'react';
import { Icon } from '../../../components/ui/Icon.jsx';
import { useI18n } from '../../../i18n/useI18n.js';
import { canSendAgain } from './composerModel.js';
import { threadGroups } from './inboxModel.js';
import { MessageAgain } from './MessageAgain.jsx';
import { MessageFiles } from '../chat/MessageFiles.jsx';
import { MessageBody } from './MessageBody.jsx';
import { useThreadScroll } from './useThreadScroll.js';

/** Status words a message may show; email never claims Read (design States artboard). */
function statusText(t, message, channel) {
  if (message.direction === 'inbound') return '';
  if (message.status === 'read' && channel === 'email') return t('inbox.message.delivered');
  if (message.status === 'sending') return t('inboxSend.message.sending');
  return t(`inbox.message.${message.status}`);
}

function Message({ message, channel, contact, t, format, again, onAgain, fileUrl }) {
  const otherSender = message.sender && message.sender !== contact ? message.sender : '';
  const outbound = message.direction === 'outbound';
  const status = statusText(t, message, channel);
  return (
    <li className={'inbox-message' + (outbound ? ' is-outbound' : ' is-inbound')}>
      <div
        className={
          'inbox-bubble' +
          (message.status === 'failed' || message.senderUnverified ? ' is-failed' : '')
        }
      >
        {/* A fraud cue: forged senders often ask for payments (security review E1c M2). */}
        {message.senderUnverified && (
          <strong className="inbox-unverified">
            <Icon name="info" size={14} />
            {t('inboxSend.message.unverified')}
          </strong>
        )}
        <MessageBody message={message} channel={channel} t={t} />
        <MessageFiles files={message.attachments} urlOf={(file) => fileUrl(message.id, file)} />
        {/* Files from clients are not scanned yet: say where they came from (F3b review M1). */}
        {!outbound && message.attachments?.length > 0 && (
          <em className="inbox-media">{t('inboxSend.message.outsideFiles')}</em>
        )}
        {message.filesNotKept > 0 ? (
          // F3b: only photos and PDFs from verified senders, within the daily limits, are kept.
          <em className="inbox-media">
            {t('inboxSend.message.filesNotKept', { count: message.filesNotKept })}
          </em>
        ) : (
          message.body &&
          message.hasMedia &&
          !message.attachments?.length && (
            <em className="inbox-media">{t('inbox.message.media')}</em>
          )
        )}
      </div>
      <span className="inbox-message-meta">
        <time dateTime={message.at}>{format.time(message.at)}</time>
        {status && <span> · {status}</span>}
        {otherSender && (
          <span>
            {' · '}
            {t('inboxSend.message.from', { sender: '' })}
            <bdi>{otherSender}</bdi>
          </span>
        )}
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
export function Thread({ data, nameOf, userId, onAgain, fileUrl }) {
  const { t, format } = useI18n();
  const box = useRef(null);
  const groups = threadGroups(data.messages, data.notes);
  const latest = data.messages.at(-1);
  const onScroll = useThreadScroll(box, data);
  const channel = data.conversation.channel;
  return (
    <div
      ref={box}
      className="inbox-thread"
      tabIndex={0}
      aria-label={t('inbox.thread.label')}
      onScroll={onScroll}
    >
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
                  contact={data.conversation.contact?.display}
                  t={t}
                  format={format}
                  again={canSendAgain(item, data.messages, userId)}
                  onAgain={onAgain}
                  fileUrl={fileUrl}
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
