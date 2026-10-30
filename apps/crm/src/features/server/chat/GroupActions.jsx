import React, { useState } from 'react';
import { Button } from '../../../components/ui/Button.jsx';
import { useI18n } from '../../../i18n/useI18n.js';
import { GroupMembersDialog } from './GroupMembersDialog.jsx';

/** Participant controls for a private group. */
export function GroupActions({ room, title, people, user, onAdd, onLeave }) {
  const { t } = useI18n();
  const [adding, setAdding] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const canAdd = room.createdBy === user.id || user.roleId === 'admin';
  const leave = async () => {
    setBusy(true);
    const failure = await onLeave();
    setBusy(false);
    if (failure) setError(t('chat.group.leaveFailed', { reason: failure }));
  };
  return (
    <>
      <div className="chat-room-actions" role="group" aria-label={t('chat.group.actions')}>
        {!confirmLeave && canAdd && (
          <Button variant="light" onClick={() => setAdding(true)}>
            {t('chat.group.add')}
          </Button>
        )}
        {confirmLeave ? (
          <>
            <span>{t('chat.group.leaveConfirm')}</span>
            <Button variant="danger-light" disabled={busy} onClick={leave}>
              {t('chat.group.leave')}
            </Button>
            <Button variant="light" disabled={busy} onClick={() => setConfirmLeave(false)}>
              {t('chat.cancel')}
            </Button>
          </>
        ) : (
          <Button variant="light" onClick={() => setConfirmLeave(true)}>
            {t('chat.group.leave')}
          </Button>
        )}
        {error && (
          <p className="field-error chat-group-action-error" role="alert">
            {error}
          </p>
        )}
      </div>
      {adding && (
        <GroupMembersDialog
          room={room}
          title={title}
          people={people}
          user={user}
          onAdd={onAdd}
          onClose={() => setAdding(false)}
        />
      )}
    </>
  );
}
