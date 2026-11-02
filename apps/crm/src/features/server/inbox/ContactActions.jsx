import React, { useState } from 'react';
import { useSession } from '../../../hooks/useSession.js';
import { useRecords, useWorkspaceActions, useWorkspaceView } from '../../../hooks/useWorkspace.js';
import { useWorkspaceScope } from '../../../hooks/useWorkspaceScope.js';
import { useI18n } from '../../../i18n/useI18n.js';
import { usePanelCommand } from '../../records/panel/panelCommands.js';
import { useMailbox } from '../mailbox/useMailbox.js';
import { sendingMailbox } from './composerModel.js';
import { contactOptions } from './contactModel.js';
import { StartEmail } from './StartEmail.jsx';

/** The new email to the person, once the member's mailbox has loaded. */
function PersonEmail({ person, onClose }) {
  const { t } = useI18n();
  const { api, user } = useSession();
  const { owner } = useWorkspaceScope();
  const { setToast } = useWorkspaceView();
  const box = useMailbox(api, owner.id);
  if (box.status === 'loading') return null;
  const start = async (body) => {
    try {
      await api.startConversation(owner.id, body);
      onClose();
      setToast(t('recordPanel.emailSent', { name: person.name || person.legacy }));
      return '';
    } catch (failure) {
      return failure.message || 'error';
    }
  };
  return (
    <StartEmail
      mailbox={sendingMailbox(box.data, user.roleId === 'admin')}
      initialTo={person}
      onStart={start}
      onClose={onClose}
    />
  );
}

/**
 * Call, Email and WhatsApp in the record slider's header for a client or contact, or the client
 * a record is about (owner, 2026-11-02; the mockup's Call and Message). Call dials the number.
 * Email opens the CRM's own new email with the person chosen, so it is sent from the member's
 * mailbox and kept in the Client inbox. WhatsApp opens a chat with the number, since WhatsApp
 * sending in the CRM is still to come (W1b). Email and WhatsApp follow the member's channel
 * grants, and the server decides every send.
 */
export function ContactActions({ module, record }) {
  const { t } = useI18n();
  const { user } = useSession();
  const { entries, keptFor } = useRecords();
  const { readOnly = false } = useWorkspaceActions();
  const [writing, setWriting] = useState(false);
  const options = readOnly
    ? { person: null }
    : contactOptions({ module, record, entries, keptFor, user });
  const { person } = options;
  const command = (key, icon, rest) =>
    options[key]
      ? {
          label: t(`recordPanel.${key}Person`),
          name: t('recordPanel.contactNamed', {
            action: t(`recordPanel.${key}Person`),
            name: person.name || person.legacy,
          }),
          icon,
          ...rest,
        }
      : null;
  usePanelCommand('call', command('call', 'phone', { href: `tel:+${options.call}` }));
  usePanelCommand('email', command('email', 'mail', { run: () => setWriting(true) }));
  usePanelCommand(
    'whatsapp',
    command('whatsapp', 'chat', { href: `https://wa.me/${options.whatsapp}` }),
  );
  return writing && person ? (
    <PersonEmail person={person} onClose={() => setWriting(false)} />
  ) : null;
}
