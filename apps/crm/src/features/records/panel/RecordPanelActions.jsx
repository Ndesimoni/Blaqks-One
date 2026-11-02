import React, { useId } from 'react';
import { Button } from '../../../components/ui/Button.jsx';
import { useSession } from '../../../hooks/useSession.js';
import { useWorkspaceActions } from '../../../hooks/useWorkspace.js';
import { useI18n } from '../../../i18n/useI18n.js';
import { hasMessagingAccess } from '../../messaging/model.js';
import { ContactCommand } from './ContactCommand.jsx';
import { ShareChoice } from './ShareChoice.jsx';

/**
 * The record's actions in the panel header. The rules are unchanged from the former footer:
 * Delete and Edit follow the caller's permissions, and a record nobody may change offers only
 * Close. The group keeps the `drawer-footer` class, the shared hook for a dialog's record
 * actions that browser checks read. Sections' `commands` add Call and Message
 * and the mockup's Share before it and, for a listing, Publish on website after it, which then
 * takes the one primary place from Edit.
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
  commands = {},
}) {
  const { t } = useI18n();
  const { startMessage } = useWorkspaceActions();
  const { user } = useSession();
  const hintId = useId();
  const changeable = !readOnly && (canDelete || canEdit);
  const publish = commands.publish?.run ? commands.publish : null;
  const shares = [commands.shareColleague, commands.shareCompany].filter((c) => c?.run);
  const contact = [commands.call, commands.message].filter((c) => c?.run || c?.href);
  return (
    <div className="record-panel-actions">
      {contact.map((command) => (
        <ContactCommand key={command.label} command={command} />
      ))}
      <ShareChoice choices={shares} />
      <div className="drawer-footer" role="group" aria-label={t('recordPanel.actions')}>
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
            variant={publish ? 'light' : 'primary'}
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
      {publish && (
        <Button icon="monitor" disabled={busy || publish.disabled} onClick={publish.run}>
          {publish.label}
        </Button>
      )}
    </div>
  );
}
