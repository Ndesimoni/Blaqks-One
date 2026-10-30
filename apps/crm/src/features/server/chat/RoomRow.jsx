import React from 'react';
import { Icon } from '../../../components/ui/Icon.jsx';
import { badge, roomTitle } from './chatModel.js';

const ICONS = { channel: 'chat', group: 'users', direct: 'person' };

/** One room in the list: its name, unread count and, when you are mentioned, `@count`. */
export function RoomRow({ room, people, selected, onOpen, t }) {
  const count = badge(room.unread);
  const mentions = badge(room.mentions);
  return (
    <li>
      <button
        type="button"
        className={'chat-room' + (selected ? ' is-selected' : '') + (count ? ' is-unread' : '')}
        aria-current={selected ? 'true' : undefined}
        onClick={() => onOpen(room.id)}
      >
        <Icon name={ICONS[room.kind] || 'chat'} size={16} />
        <span className="chat-room-name">
          <bdi>{roomTitle(room, people, t)}</bdi>
        </span>
        {mentions && (
          <span className="chat-mention-badge">
            <span aria-hidden="true">@{mentions}</span>
            <span className="sr-only">
              {t('chat.mention.count', { count: Number(room.mentions) })}
            </span>
          </span>
        )}
        {count && <span className="chat-badge">{count}</span>}
      </button>
    </li>
  );
}
