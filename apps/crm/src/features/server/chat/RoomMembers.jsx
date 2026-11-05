import React from 'react';
import { useI18n } from '../../../i18n/useI18n.js';
import { initials } from '../profile/profileModel.js';
import { roomMemberNames } from './chatModel.js';

/** The approved mockup's Members pane beside a Team chat conversation, with the caller first. */
export function RoomMembers({ room, people }) {
  const { t } = useI18n();
  const names = roomMemberNames(room, people);
  return (
    <aside className="chat-members-pane" aria-labelledby="chat-members-title">
      <h2 id="chat-members-title">{t('chat.membersCount', { count: names.length + 1 })}</h2>
      <ul>
        {[t('chat.you'), ...names].map((name, index) => (
          <li key={`${index}-${name}`}>
            <span className="chat-room-avatar" aria-hidden="true">
              {initials(name)}
            </span>
            <span>{name}</span>
          </li>
        ))}
      </ul>
    </aside>
  );
}
