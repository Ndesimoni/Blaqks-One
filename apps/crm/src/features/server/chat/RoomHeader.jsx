import React from 'react';
import { Button } from '../../../components/ui/Button.jsx';
import { Icon } from '../../../components/ui/Icon.jsx';
import { useI18n } from '../../../i18n/useI18n.js';
import { groupNames } from './chatModel.js';
import { GroupActions } from './GroupActions.jsx';

function note(room, t) {
  if (room.kind === 'channel') return t('chat.channel.everyone');
  if (room.kind === 'group') return t('chat.group.private', { count: room.members?.length ?? 0 });
  return t('chat.direct.private');
}

/**
 * The open room's title and who can read it. In a group: its members, Add people (creator
 * or a participating Admin) and Leave group (packet C3).
 */
export function RoomHeader({ room, title, people, user, onBack, onAdd, onLeave }) {
  const { t } = useI18n();
  const group = room.kind === 'group';
  const members = group ? [t('chat.you'), ...groupNames(room, people)].join(', ') : '';
  return (
    <header className="chat-room-head">
      <Button
        variant="light"
        icon="arrow"
        className="chat-back"
        aria-label={t('chat.back')}
        onClick={onBack}
      />
      <div className="chat-room-title">
        <h2>
          <bdi>{title}</bdi>
        </h2>
        <p>
          <Icon name={room.kind === 'channel' ? 'users' : 'lock'} size={14} />
          {note(room, t)}
        </p>
        {group && (
          <p className="chat-room-members" title={members}>
            {members}
          </p>
        )}
      </div>
      {group && (
        <GroupActions
          room={room}
          title={title}
          people={people}
          user={user}
          onAdd={onAdd}
          onLeave={onLeave}
        />
      )}
    </header>
  );
}
