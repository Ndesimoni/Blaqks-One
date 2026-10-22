import React, { useMemo, useRef } from 'react';
import { Button } from '../../../components/ui/Button.jsx';
import { useI18n } from '../../../i18n/useI18n.js';
import { useThreadScroll } from '../inbox/useThreadScroll.js';
import { ChatComposer } from './ChatComposer.jsx';
import { ChatMessage } from './ChatMessage.jsx';
import { dayOf, mentionable, roomTitle } from './chatModel.js';
import { RoomHeader } from './RoomHeader.jsx';
import { useRoom } from './useRoom.js';

/**
 * The open channel, group or private conversation: messages by day and the composer. In
 * channels and groups, `@` mentions the colleagues who can see the room (packet C3).
 */
export function RoomView({ api, workspaceId, room, people, user, onBack, onRead, onLeave }) {
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
  const suggest = useMemo(() => mentionable(room, people), [room, people]);
  // Mentions are shown for the reader and live colleagues; edits keep only those who
  // can still see the room.
  const known = useMemo(() => [{ id: user.id, name: user.name }, ...people], [user, people]);
  const allowed = new Set([user.id, ...suggest.map((person) => person.id)]);
  const namedIn = (message) =>
    known.filter((person) => (message.mentions ?? []).includes(person.id));
  const edit = (id, body, mentions) =>
    view.edit(
      id,
      body,
      mentions?.filter((member) => allowed.has(member)),
    );
  const title = roomTitle(room, people, t);
  let day = '';
  return (
    <>
      <RoomHeader room={room} title={title} people={people} onBack={onBack} onLeave={onLeave} />
      <div ref={box} className="chat-thread" tabIndex={0} aria-label={title} onScroll={onScroll}>
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
                  named={namedIn(message)}
                  me={user.id}
                  onEdit={edit}
                  onRemove={view.remove}
                  urlOf={(file) => api.chatFileUrl(workspaceId, room.id, message.id, file)}
                />
              </React.Fragment>
            );
          })}
        </ol>
      </div>
      <ChatComposer api={api} workspaceId={workspaceId} onSend={view.send} people={suggest} />
    </>
  );
}
