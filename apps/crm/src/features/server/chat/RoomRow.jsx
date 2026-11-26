import React from 'react';
import { useSession } from '../../../hooks/useSession.js';
import { initials } from '../profile/profileModel.js';
import { badge, previewLine, roomTitle } from './chatModel.js';
import './chat-avatars.css';

/**
 * One room in the list, as the approved mockup shows it: an initials avatar, its name over
 * its latest message, its unread count and, when you are mentioned, `@count`.
 */
export function RoomRow({ room, people, selected, onOpen, t }) {
  const { user } = useSession();
  const count = badge(room.unread);
  const mentions = badge(room.mentions);
  const title = roomTitle(room, people, t);
  const preview = previewLine(room, people, user.id, t);
  return (
    <li>
      <button
        type="button"
        className={'chat-room' + (selected ? ' is-selected' : '') + (count ? ' is-unread' : '')}
        aria-current={selected ? 'true' : undefined}
        onClick={() => onOpen(room.id)}
      >
        <span className={`chat-room-avatar is-${room.kind}`} aria-hidden="true">
          {initials(title.replace(/^#/, ''))}
        </span>
        <span className="chat-room-text">
          <span className="chat-room-name">
            <bdi>{title}</bdi>
          </span>
          {preview && (
            <span className="chat-room-preview">
              <bdi>{preview}</bdi>
            </span>
          )}
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
