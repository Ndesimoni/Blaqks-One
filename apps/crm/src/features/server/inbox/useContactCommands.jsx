import React, { useState } from 'react';
import { useSession } from '../../../hooks/useSession.js';
import { useRecords, useWorkspaceActions, useWorkspaceView } from '../../../hooks/useWorkspace.js';
import { useWorkspaceScope } from '../../../hooks/useWorkspaceScope.js';
import { useI18n } from '../../../i18n/useI18n.js';
import { canOpenSection } from '../access.js';
import { useOpenMessenger } from '../products/messenger/messengerContext.js';
import { plainEmail } from './composerModel.js';
import { contactOptions, linkedConversation } from './contactModel.js';
import { PersonMessage } from './PersonMessage.jsx';

/**
 * Call and Message for a client or contact, or the client a record is about (owner,
 * 2026-11-02: the mockup's Call and Message, one way into the chat), as `{ options, commands:
 * { call, message }, dialog }` for the record slider's header and the Client desk. Call dials
 * the number. Message opens the person's latest conversation (email or WhatsApp) in the
 * messenger when one is among the member's recent ones; else it starts a message to the person
 * (`dialog`): a new email, or on WhatsApp from the member's own number (W1b), as the member's
 * grants and the person's details allow, whose conversation then opens; with neither, it says so.
 * The member's grants and the server decide what may be read or sent.
 */
export function useContactCommands({ module, record }) {
  const { t } = useI18n();
  const { api, user } = useSession();
  const { owner } = useWorkspaceScope();
  const { entries, keptFor } = useRecords();
  const { readOnly = false } = useWorkspaceActions();
  const { setToast } = useWorkspaceView();
  const openMessenger = useOpenMessenger();
  const messages = openMessenger && canOpenSection(user, 'Inbox') ? openMessenger : null;
  const [writing, setWriting] = useState(false);
  const [looking, setLooking] = useState(false);
  const options = readOnly
    ? { person: null, call: '', email: false, whatsapp: '' }
    : contactOptions({ module, record, entries, keptFor, user });
  const { person } = options;
  const name = person?.name || person?.legacy;
  const channels = [options.email && 'email', options.whatsapp && 'whatsapp'].filter(Boolean);
  const command = (key, icon, offered, rest) =>
    offered
      ? {
          label: t(`recordPanel.${key}Person`),
          name: t('recordPanel.contactNamed', {
            action: t(`recordPanel.${key}Person`),
            name,
          }),
          icon,
          ...rest,
        }
      : null;
  // A failed lookup still lets the member write a new email.
  const message = async () => {
    if (messages) {
      setLooking(true);
      const page = await api.conversations(owner.id, { limit: 100 }).catch(() => null);
      setLooking(false);
      const existing = linkedConversation(page?.conversations, person);
      if (existing) return messages('inbox', existing);
    }
    if (channels.length) setWriting(true);
    else {
      const key = plainEmail(person.email) ? 'noConversationGrant' : 'noConversation';
      setToast(t(`recordPanel.${key}`, { name }));
    }
  };
  return {
    options,
    commands: {
      call: command('call', 'phone', options.call, { href: `tel:+${options.call}` }),
      message: command('message', 'chat', person && (messages || channels.length > 0), {
        run: message,
        disabled: looking,
      }),
    },
    dialog:
      writing && person ? (
        <PersonMessage
          person={person}
          channels={channels}
          onSent={messages && ((id) => messages('inbox', id))}
          onClose={() => setWriting(false)}
        />
      ) : null,
  };
}
