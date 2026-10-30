import React from 'react';
import { useSession } from '../../hooks/useSession.js';
import { TeamWizard } from '../team/TeamWizard.jsx';
import { validPhone } from '../team/model.js';
import { MessageFields, MessageReview } from './MessageContent.jsx';
import { plannedSender, validEmail, validateMessage } from './model.js';
import { useWorkspaceActions } from '../../hooks/useWorkspace.js';

export function MessagePreviewDialog({ channel, recipient, staff = false, onClose }) {
  const { user } = useSession();
  const { recordActivity } = useWorkspaceActions();
  const allowed = staff ? user.managesTeam : user.channelAccess?.[channel] === true;
  const address = channel === 'whatsapp' ? recipient.phone : recipient.email;
  const available = channel === 'whatsapp' ? validPhone(address) : validEmail(address);
  const sender = plannedSender(user, channel);
  const initial = { channel, subject: '', body: '' };
  const unavailable = !allowed
    ? 'Your Super Admin has not allowed this messaging channel.'
    : !available
      ? 'Add a valid recipient contact detail before previewing.'
      : '';
  return (
    <TeamWizard
      eyebrow="MESSAGING · FRONTEND PREVIEW"
      title={
        channel === 'email'
          ? 'Client email preview'
          : staff
            ? 'Staff WhatsApp preview'
            : 'Client WhatsApp preview'
      }
      subtitle="Preview the conversation. No message will be sent and no sender account is connected."
      initial={initial}
      steps={[
        {
          id: 'compose',
          title: 'Compose',
          validate: (form) => ({
            ...validateMessage(form),
            ...(unavailable ? { body: unavailable } : {}),
          }),
          render: (props) => (
            <div className="team-fields">
              <dl className="team-review">
                <div>
                  <dt>To</dt>
                  <dd>
                    {recipient.name} · {address || 'Missing contact detail'}
                  </dd>
                </div>
                <div>
                  <dt>Planned sender</dt>
                  <dd>{sender}</dd>
                </div>
              </dl>
              {unavailable && (
                <p className="field-error" role="alert">
                  {unavailable}
                </p>
              )}
              <MessageFields {...props} greeting={recipient.name} />
              <p className="team-muted">
                {channel === 'email'
                  ? 'Live email will require this member to authorize their own Gmail, Outlook or other supported mailbox.'
                  : 'Live WhatsApp will require a connected business sender. A member’s personal phone identifies where to reach them.'}
              </p>
            </div>
          ),
        },
        {
          id: 'review',
          title: 'Message preview',
          render: ({ form }) => (
            <MessageReview form={form} sender={sender} recipientName={recipient.name} />
          ),
        },
      ]}
      finishLabel="Close preview"
      onClose={onClose}
      onFinish={() => {
        if (unavailable) throw Error(unavailable);
        // Connected previews are not logged: connected activity is written only with record changes.
        recordActivity?.({
          action: 'message-preview',
          module: 'Messages',
          label: `${staff ? 'Staff' : 'Client'} ${channel === 'email' ? 'email' : 'WhatsApp'} preview · not sent`,
        });
      }}
      onSuccess={onClose}
    />
  );
}
