import React, { useId } from 'react';
import { Button } from '../../../components/ui/Button.jsx';
import { useSession } from '../../../hooks/useSession.js';
import { useWorkspaceActions } from '../../../hooks/useWorkspace.js';
import { useI18n } from '../../../i18n/useI18n.js';
import { hasMessagingAccess } from '../../messaging/model.js';

/**
 * The record's actions in the panel header, with Edit as the one primary action. The rules
 * are unchanged from the former footer: Delete and Edit follow the caller's permissions,
 * and a record nobody may change offers only Close. The group keeps the `drawer-footer`
 * class, the shared hook for a dialog's record actions that browser checks read.
 */
export function RecordPanelActions({
  module,
  record,
  lead,
  busy,
  readOnly,
  canDelete,
  canEdit,
  showMessaging,
  edit,
  remove,
  close,
}) {
  const { t } = useI18n();
  const { startMessage } = useWorkspaceActions();
  const { user } = useSession();
  const hintId = useId();
  const changeable = !readOnly && (canDelete || canEdit);
  return (
    <div
      className="record-panel-actions drawer-footer"
      role="group"
      aria-label={t('recordPanel.actions')}
    >
      {module === 'Clients' && showMessaging && !readOnly && (
        <>
          <Button
            variant="light"
            icon="chat"
            disabled={!hasMessagingAccess(user)}
            aria-describedby={hintId}
            title={t('recordPanel.startMessageHint')}
            onClick={() => startMessage(record)}
          >
            {t('recordPanel.startMessage')}
          </Button>
          <span id={hintId} className="sr-only">
            {t('recordPanel.startMessageHint')}
          </span>
        </>
      )}
      {!changeable && (
        <Button variant="light" onClick={close}>
          {t('recordPanel.closeText')}
        </Button>
      )}
      {changeable && canDelete && (
        <Button
          variant="danger-light"
          icon="trash"
          disabled={busy}
          onClick={() => remove(module, record)}
        >
          {t('recordPanel.delete')}
        </Button>
      )}
      {changeable && canEdit && (
        <Button
          icon="edit"
          disabled={busy}
          onClick={() => {
            close();
            edit(module, record);
          }}
        >
          {t(lead ? 'recordPanel.editLead' : 'recordPanel.editRecord')}
        </Button>
      )}
    </div>
  );
}
