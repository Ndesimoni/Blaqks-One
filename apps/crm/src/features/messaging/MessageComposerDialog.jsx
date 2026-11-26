import React, { useState } from 'react';
import { useSession } from '../../hooks/useSession.js';
import { useRecords, useWorkspaceActions } from '../../hooks/useWorkspace.js';
import { TeamWizard } from '../team/TeamWizard.jsx';
import { MessageAudience } from './MessageAudience.jsx';
import { MessageFields, MessageReview } from './MessageContent.jsx';
import {
  createMessageDraft,
  createMessagePreview,
  parseRecipients,
  plannedSender,
  recipientField,
  validateAudience,
  validateMessage,
} from './model.js';

export function MessageComposerDialog({ client, channel, onClose, onComplete }) {
  const { user } = useSession();
  const { data } = useRecords();
  const { recordActivity } = useWorkspaceActions();
  const [initial] = useState(() => createMessageDraft(user, client, channel));
  const name = client?.full_name || client?.name;
  return (
    <TeamWizard
      eyebrow="MESSAGING · FRONTEND PREVIEW"
      title={name ? `Start message with ${name}` : 'Start a message'}
      subtitle="Choose Email or WhatsApp, add one or several recipients, then review your message."
      initial={initial}
      steps={[
        {
          id: 'audience',
          title: 'Channel & recipients',
          validate: (form) => validateAudience(form, user),
          render: (props) => (
            <MessageAudience
              {...props}
              user={user}
              clients={data.Clients}
              contacts={data.Contacts}
              client={client}
            />
          ),
        },
        {
          id: 'compose',
          title: 'Write message',
          validate: validateMessage,
          render: (props) => {
            const count = parseRecipients(
              props.form[recipientField(props.form.channel)],
              props.form.channel,
            ).recipients.length;
            return (
              <div className="team-fields">
                <dl className="team-review">
                  <div>
                    <dt>Channel</dt>
                    <dd>{props.form.channel === 'email' ? 'Email' : 'WhatsApp'}</dd>
                  </div>
                  <div>
                    <dt>Recipients</dt>
                    <dd>{count} · Individual delivery planned</dd>
                  </div>
                  <div>
                    <dt>Planned sender</dt>
                    <dd>{plannedSender(user, props.form.channel)}</dd>
                  </div>
                </dl>
                <MessageFields {...props} greeting={count === 1 ? name || 'there' : 'there'} />
                <p className="team-muted">
                  Sender not connected. This draft will only be previewed.
                </p>
              </div>
            );
          },
        },
        {
          id: 'review',
          title: 'Review message',
          render: ({ form }) => (
            <MessageReview
              form={form}
              sender={plannedSender(user, form.channel)}
              recipientName="Your message"
              recipients={
                parseRecipients(form[recipientField(form.channel)], form.channel).recipients
              }
            />
          ),
        },
      ]}
      finishLabel="Close preview"
      onClose={onClose}
      onFinish={(form) => {
        const preview = createMessagePreview(form, user);
        const count = parseRecipients(form[recipientField(form.channel)], form.channel).recipients
          .length;
        recordActivity({
          action: 'message-preview',
          module: 'Messages',
          label: `${form.channel === 'email' ? 'Email' : 'WhatsApp'} preview for ${count} recipient${count === 1 ? '' : 's'} · not sent`,
        });
        return preview;
      }}
      onSuccess={onComplete}
    />
  );
}
