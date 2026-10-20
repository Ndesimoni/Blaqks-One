import React, { useState } from 'react';
import { Button } from '../../../components/ui/Button.jsx';
import { Icon } from '../../../components/ui/Icon.jsx';
import { useI18n } from '../../../i18n/useI18n.js';
import { badge, roomTitle, splitRooms } from './chatModel.js';
import { NewConversation } from './NewConversation.jsx';

function RoomRow({ room, people, selected, onOpen, t }) {
  const count = badge(room.unread);
  return (
    <li>
      <button
        type="button"
        className={'chat-room' + (selected ? ' is-selected' : '') + (count ? ' is-unread' : '')}
        aria-current={selected ? 'true' : undefined}
        onClick={() => onOpen(room.id)}
      >
        <Icon name={room.kind === 'channel' ? 'chat' : 'person'} size={16} />
        <span className="chat-room-name">
          <bdi>{roomTitle(room, people, t)}</bdi>
        </span>
        {count && <span className="chat-badge">{count}</span>}
      </button>
    </li>
  );
}

/** Channels and direct messages, with New channel (the Admin) and New message. */
export function RoomList({ chat, selectedId, onOpen }) {
  const { t } = useI18n();
  const [mode, setMode] = useState(null);
  const { channels, direct } = splitRooms(chat.rooms);
  const opened = (result) => {
    if (result.error) return result.error;
    setMode(null);
    onOpen(result.room.id);
    return '';
  };
  if (mode)
    return (
      <section className="chat-list" aria-label={t('chat.rooms')}>
        <NewConversation
          mode={mode}
          people={chat.people}
          onChannel={async (name) => opened(await chat.createChannel(name))}
          onDirect={async (id) => opened(await chat.openDirect(id))}
          onCancel={() => setMode(null)}
        />
      </section>
    );
  const group = (title, rooms, action) => (
    <div className="chat-group">
      <div className="chat-group-head">
        <h2>{title}</h2>
        {action}
      </div>
      <ul>
        {rooms.map((room) => (
          <RoomRow
            key={room.id}
            room={room}
            people={chat.people}
            selected={room.id === selectedId}
            onOpen={onOpen}
            t={t}
          />
        ))}
      </ul>
    </div>
  );
  const add = (key, next) => (
    <Button
      variant="light"
      icon="plus"
      className="chat-add"
      aria-label={t(key)}
      title={t(key)}
      onClick={() => setMode(next)}
    />
  );
  return (
    <section className="chat-list" aria-label={t('chat.rooms')}>
      {group(
        t('chat.channels'),
        channels,
        chat.canCreateChannel && add('chat.newChannel', 'channel'),
      )}
      {group(t('chat.direct'), direct, add('chat.newMessage', 'direct'))}
    </section>
  );
}
