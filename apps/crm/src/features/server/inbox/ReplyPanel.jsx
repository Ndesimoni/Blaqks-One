import React from 'react';
import { Button } from '../../../components/ui/Button.jsx';
import { useNavigation } from '../../../hooks/useWorkspace.js';
import { useI18n } from '../../../i18n/useI18n.js';
import { ReplyForm } from './ReplyForm.jsx';
import { WhatsappReply } from './whatsapp/WhatsappReply.jsx';

/** Why this member cannot reply here, with the way to fix it when there is one. */
function ReplyNotice({ state, channel }) {
  const { t } = useI18n();
  const { navigate } = useNavigation();
  const channelName = t(`inbox.channel.${channel}`);
  const own = [
    'connectMailbox',
    'reconnect',
    'needAddress',
    'adminNeedsAddress',
    'companyReconnect',
    'otherMailbox',
    'notSendable',
  ].includes(state);
  return (
    <div className="inbox-reply-notice" role="status">
      <span>
        {own ? t(`inboxSend.reply.${state}`) : t(`inbox.reply.${state}`, { channel: channelName })}
      </span>
      {state === 'adminNeedsAddress' && (
        <Button variant="light" onClick={() => navigate('Channels')}>
          {t('inboxSend.reply.openChannels')}
        </Button>
      )}
      {['connectMailbox', 'reconnect'].includes(state) && (
        <Button variant="light" onClick={() => navigate('My mailbox')}>
          {t('inboxSend.reply.openMailbox')}
        </Button>
      )}
    </div>
  );
}

/**
 * The Reply tab (E1d): the reply form when the member may send from this conversation's
 * mailbox (O9), otherwise an honest notice. The form is keyed by conversation, so moving to
 * another conversation saves this draft and opens that one's (N2). WhatsApp conversations
 * get their own composer (W1b), keyed the same way.
 */
export function ReplyPanel(props) {
  const { id, state, conversation, mailbox, toolSlot, onPicked, onReply, whatsapp } = props;
  if (state === 'whatsapp')
    return (
      <WhatsappReply
        key={conversation.id}
        id={id}
        conversation={conversation}
        user={whatsapp.user}
        members={whatsapp.members}
        toolSlot={toolSlot}
        onPicked={onPicked}
        actions={{ reply: onReply, sendTemplate: whatsapp.sendTemplate, consent: whatsapp.consent }}
      />
    );
  if (state !== 'send') return <ReplyNotice state={state} channel={conversation.channel} />;
  return (
    <ReplyForm
      key={conversation.id}
      id={id}
      conversation={conversation}
      mailbox={mailbox}
      toolSlot={toolSlot}
      onPicked={onPicked}
      onReply={onReply}
    />
  );
}
