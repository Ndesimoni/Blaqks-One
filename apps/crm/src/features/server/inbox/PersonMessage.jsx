import React, { useId, useState } from 'react';
import { Drawer } from '../../../components/ui/Drawer.jsx';
import { Tabs, tabPanelProps } from '../../../components/ui/Tabs.jsx';
import { useSession } from '../../../hooks/useSession.js';
import { useWorkspaceView } from '../../../hooks/useWorkspace.js';
import { useWorkspaceScope } from '../../../hooks/useWorkspaceScope.js';
import { useI18n } from '../../../i18n/useI18n.js';
import { useMailbox } from '../mailbox/useMailbox.js';
import { sendingMailbox } from './composerModel.js';
import { StartTop } from './StartEmail.jsx';
import { StartEmailForm } from './StartEmailForm.jsx';
import { StartWhatsapp } from './whatsapp/StartWhatsapp.jsx';

const TITLES = { email: 'inboxSend.start.title', whatsapp: 'whatsappStart.title' };

/**
 * Start message to one client or contact from their record (E1d; WhatsApp W1b): one drawer
 * whose title names the channel, with Email and WhatsApp as tabs when the member may use
 * both (`channels`, email first). Each tab keeps its draft while the other is open; the
 * WhatsApp tab loads when first chosen. When sent, the conversation opens in the messenger
 * (`onSent`), else a toast confirms it.
 */
export function PersonMessage({ person, channels, onSent, onClose }) {
  const { t } = useI18n();
  const { api, user } = useSession();
  const { owner } = useWorkspaceScope();
  const { setToast } = useWorkspaceView();
  const box = useMailbox(api, owner.id);
  const id = useId();
  const [channel, setChannel] = useState(channels[0]);
  const [seen, setSeen] = useState([channels[0]]);
  // Wait for the mailbox, so the email's Subject takes focus when the drawer opens.
  if (channels.includes('email') && box.status === 'loading') return null;
  const name = person.name || person.legacy;
  const finish = (conversationId, toast) => {
    onClose();
    if (onSent && conversationId) onSent(conversationId);
    else if (toast) setToast(toast);
  };
  const startEmail = async (body) => {
    try {
      const { conversationId } = await api.startConversation(owner.id, body);
      finish(conversationId, t('recordPanel.emailSent', { name }));
      return '';
    } catch (failure) {
      return failure.message || 'error';
    }
  };
  const prefix = `${id}-channel`;
  const tabbed = channels.length > 1;
  const panel = (key) => (tabbed ? tabPanelProps(prefix, key, channel) : {});
  const choose = (next) => {
    setChannel(next);
    setSeen((current) => (current.includes(next) ? current : [...current, next]));
  };
  return (
    <Drawer className="inbox-start" titleId={`${id}-title`} onClose={onClose}>
      <StartTop id={`${id}-title`} title={t(TITLES[channel])} onClose={onClose} />
      {tabbed && (
        <div className="inbox-start-channels">
          <Tabs
            label={t('whatsappStart.channels')}
            tabs={channels.map((key) => ({ id: key, label: t(`whatsappStart.${key}`) }))}
            value={channel}
            onChange={choose}
            idPrefix={prefix}
          />
        </div>
      )}
      {channels.includes('email') && (
        <StartEmailForm
          mailbox={sendingMailbox(box.data, user.roleId === 'admin')}
          initialTo={person}
          panel={panel('email')}
          onStart={startEmail}
        />
      )}
      {seen.includes('whatsapp') && (
        <StartWhatsapp
          person={person}
          panel={panel('whatsapp')}
          onStarted={(conversationId) => finish(conversationId, t('whatsappStart.sent', { name }))}
          onOpen={onSent && ((conversationId) => finish(conversationId))}
        />
      )}
    </Drawer>
  );
}
