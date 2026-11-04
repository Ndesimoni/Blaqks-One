import React from 'react';
import { useSession } from '../../../hooks/useSession.js';
import { useWorkspaceView } from '../../../hooks/useWorkspace.js';
import { useWorkspaceScope } from '../../../hooks/useWorkspaceScope.js';
import { useI18n } from '../../../i18n/useI18n.js';
import { useMailbox } from '../mailbox/useMailbox.js';
import { sendingMailbox } from './composerModel.js';
import { StartEmail } from './StartEmail.jsx';

/**
 * The new email to the person (or to a client the member picks when `person` is null), once
 * the member's mailbox has loaded, starting with any `subject` and `body`. When sent, its
 * conversation opens in the messenger (`onSent`), else a toast confirms it.
 */
export function PersonEmail({ person = null, subject = '', body: text = '', onSent, onClose }) {
  const { t } = useI18n();
  const { api, user } = useSession();
  const { owner } = useWorkspaceScope();
  const { setToast } = useWorkspaceView();
  const box = useMailbox(api, owner.id);
  if (box.status === 'loading') return null;
  const start = async (body) => {
    try {
      const { conversationId } = await api.startConversation(owner.id, body);
      onClose();
      if (onSent && conversationId) onSent(conversationId);
      else
        setToast(
          person
            ? t('recordPanel.emailSent', { name: person.name || person.legacy })
            : t('recordPanel.emailSentPlain'),
        );
      return '';
    } catch (failure) {
      return failure.message || 'error';
    }
  };
  return (
    <StartEmail
      mailbox={sendingMailbox(box.data, user.roleId === 'admin')}
      initialTo={person}
      initialSubject={subject}
      initialBody={text}
      onStart={start}
      onClose={onClose}
    />
  );
}
