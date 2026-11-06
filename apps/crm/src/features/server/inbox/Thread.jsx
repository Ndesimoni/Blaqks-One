import React, { useRef } from 'react';
import { useI18n } from '../../../i18n/useI18n.js';
import { canSendAgain } from './composerModel.js';
import { threadGroups } from './inboxModel.js';
import { ThreadMessage } from './ThreadMessage.jsx';
import { useThreadScroll } from './useThreadScroll.js';

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
                <ThreadMessage
                  key={item.id}
                  message={item}
                  conversation={data.conversation}
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
