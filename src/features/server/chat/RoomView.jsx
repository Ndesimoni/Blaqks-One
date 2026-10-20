import React, { useRef } from 'react';
import { Button } from '../../../components/ui/Button.jsx';
import { Icon } from '../../../components/ui/Icon.jsx';
import { useI18n } from '../../../i18n/useI18n.js';
import { useThreadScroll } from '../inbox/useThreadScroll.js';
import { ChatComposer } from './ChatComposer.jsx';
import { ChatMessage } from './ChatMessage.jsx';
import { dayOf, roomTitle } from './chatModel.js';
import { useRoom } from './useRoom.js';

/** The open channel or private conversation: messages by day and the composer. */
export function RoomView({ api, workspaceId, room, people, user, onBack, onRead }) {
  const { t, format } = useI18n();
  const box = useRef(null);
  const view = useRoom(api, workspaceId, room.id, onRead);
  const onScroll = useThreadScroll(box, {
    conversation: { id: room.id },
    messages: view.messages,
    notes: [],
  });
  const nameOf = (id) => people.find((person) => person.id === id)?.name || t('chat.formerMember');
  const channel = room.kind === 'channel';
  const moderator = channel && user.roleId === 'admin';
  let day = '';
  return (
    <>
      <header className="chat-room-head">
        <Button
          variant="light"
          icon="arrow"
          className="chat-back"
          aria-label={t('chat.back')}
          onClick={onBack}
        />
        <div>
          <h2>
            <bdi>{roomTitle(room, people, t)}</bdi>
          </h2>
          <p>
            <Icon name={channel ? 'users' : 'lock'} size={14} />
            {t(channel ? 'chat.channel.everyone' : 'chat.direct.private')}
          </p>
        </div>
      </header>
      <div
        ref={box}
        className="chat-thread"
        tabIndex={0}
        aria-label={roomTitle(room, people, t)}
        onScroll={onScroll}
      >
        {view.status === 'loading' && <p role="status">{t('chat.loading')}</p>}
        {view.status === 'error' && (
          <p className="field-error" role="alert">
            {t('chat.loadFailed')}
          </p>
        )}
        {view.more && (
          <Button variant="light" className="chat-earlier" onClick={view.earlier}>
            {t('chat.earlier')}
          </Button>
        )}
        {view.status === 'ready' && view.messages.length === 0 && (
          <p className="chat-muted chat-empty">{t('chat.empty')}</p>
        )}
        <ol className="chat-messages" aria-live="polite">
          {view.messages.map((message) => {
            const next = dayOf(message.at);
            const separator = next !== day;
            day = next;
            return (
              <React.Fragment key={message.id}>
                {separator && (
                  <li className="chat-day" aria-hidden="true">
                    {format.date(message.at, { dateStyle: 'medium' })}
                  </li>
                )}
                <ChatMessage
                  message={message}
                  author={nameOf(message.authorId)}
                  mine={message.authorId === user.id}
                  canRemove={moderator}
                  onEdit={view.edit}
                  onRemove={view.remove}
                />
              </React.Fragment>
            );
          })}
        </ol>
      </div>
      <ChatComposer onSend={view.send} />
    </>
  );
}
