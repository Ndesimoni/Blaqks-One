import React, { useState } from 'react';
import { Button } from '../../../components/ui/Button.jsx';
import { Icon } from '../../../components/ui/Icon.jsx';
import { useI18n } from '../../../i18n/useI18n.js';
import { groupNames } from './chatModel.js';

function note(room, t) {
  if (room.kind === 'channel') return t('chat.channel.everyone');
  if (room.kind === 'group') return t('chat.group.private', { count: room.members?.length ?? 0 });
  return t('chat.direct.private');
}

/**
 * The open room's title and who can read it. In a group: its members and Leave group, with
 * a confirmation (packet C3).
 */
export function RoomHeader({ room, title, people, onBack, onLeave }) {
  const { t } = useI18n();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const group = room.kind === 'group';
  const members = group ? [t('chat.you'), ...groupNames(room, people)].join(', ') : '';
  const leave = async () => {
    setBusy(true);
    const failure = await onLeave();
    setBusy(false);
    if (failure) setError(t('chat.group.leaveFailed', { reason: failure }));
  };
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
        {error && (
          <p className="field-error" role="alert">
            {error}
          </p>
        )}
      </div>
      {group && (
        <div className="chat-room-actions" role="group" aria-label={t('chat.group.actions')}>
          {confirm ? (
            <>
              <span>{t('chat.group.leaveConfirm')}</span>
              <Button variant="danger-light" disabled={busy} onClick={leave}>
                {t('chat.group.leave')}
              </Button>
              <Button variant="light" onClick={() => setConfirm(false)}>
                {t('chat.cancel')}
              </Button>
            </>
          ) : (
            <Button variant="light" onClick={() => setConfirm(true)}>
              {t('chat.group.leave')}
            </Button>
          )}
        </div>
      )}
    </header>
  );
}
