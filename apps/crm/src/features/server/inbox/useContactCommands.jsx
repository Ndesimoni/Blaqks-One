import React, { useState } from 'react';
import { useSession } from '../../../hooks/useSession.js';
import { useRecords, useWorkspaceActions } from '../../../hooks/useWorkspace.js';
import { useWorkspaceScope } from '../../../hooks/useWorkspaceScope.js';
import { useI18n } from '../../../i18n/useI18n.js';
import { canOpenSection } from '../access.js';
import { useOpenMessenger } from '../products/messenger/messengerContext.js';
import { contactOptions, linkedConversation } from './contactModel.js';
import { PersonEmail } from './PersonEmail.jsx';

/**
 * Call, Email and WhatsApp for a client or contact, or the client a record is about (owner,
 * 2026-11-02), as `{ options, commands: { call, email, whatsapp }, dialog }` for the record
 * slider's header and the Client desk. Call dials the number. Email opens the person's latest
 * email conversation in the messenger when one is among the member's recent ones, else the
 * Messages "New email" with the person chosen (`dialog`), whose conversation then opens.
 * WhatsApp opens a chat with the number, since WhatsApp sending in the CRM is still to come
 * (W1b). Email and WhatsApp follow the member's channel grants; the server decides every send.
 */
export function useContactCommands({ module, record }) {
  const { t } = useI18n();
  const { api, user } = useSession();
  const { owner } = useWorkspaceScope();
  const { entries, keptFor } = useRecords();
  const { readOnly = false } = useWorkspaceActions();
  const openMessenger = useOpenMessenger();
  const messages = openMessenger && canOpenSection(user, 'Inbox') ? openMessenger : null;
  const [writing, setWriting] = useState(false);
  const [looking, setLooking] = useState(false);
  const options = readOnly
    ? { person: null, call: '', email: false, whatsapp: '' }
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
  // A failed lookup still lets the member write a new email.
  const email = async () => {
    if (!messages) return setWriting(true);
    setLooking(true);
    const page = await api
      .conversations(owner.id, { channel: 'email', limit: 100 })
      .catch(() => null);
    setLooking(false);
    const existing = linkedConversation(page?.conversations, person);
    if (existing) messages('inbox', existing);
    else setWriting(true);
  };
  return {
    options,
    commands: {
      call: command('call', 'phone', { href: `tel:+${options.call}` }),
      email: command('email', 'mail', { run: email, disabled: looking }),
      whatsapp: command('whatsapp', 'chat', { href: `https://wa.me/${options.whatsapp}` }),
    },
    dialog:
      writing && person ? (
        <PersonEmail
          person={person}
          onSent={messages && ((id) => messages('inbox', id))}
          onClose={() => setWriting(false)}
        />
      ) : null,
  };
}
