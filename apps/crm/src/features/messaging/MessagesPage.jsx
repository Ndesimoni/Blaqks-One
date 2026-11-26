import React from 'react';
import { Button } from '../../components/ui/Button.jsx';
import { Icon } from '../../components/ui/Icon.jsx';
import { useSession } from '../../hooks/useSession.js';
import { useWorkspaceActions } from '../../hooks/useWorkspace.js';
import { hasMessagingAccess } from './model.js';

export function MessagesPage() {
  const { user } = useSession();
  const { startMessage } = useWorkspaceActions();
  return (
    <div className="messages-page">
      <section className="panel messages-intro">
        <div>
          <span className="team-preview-label">CLIENT COMMUNICATIONS</span>
          <h2>Start a conversation</h2>
          <p>
            Reach one client or prepare the same message for several people. Enter email addresses
            or WhatsApp numbers, or choose saved clients, leads and landlords.
          </p>
        </div>
        <Button icon="plus" disabled={!hasMessagingAccess(user)} onClick={() => startMessage()}>
          Start a message
        </Button>
      </section>
      {!hasMessagingAccess(user) && (
        <p className="team-notice" role="status">
          Your Super Admin has not allowed client messaging. Ask them to enable Email, WhatsApp or
          both from Team & access.
        </p>
      )}
      <div className="message-channel-cards">
        {['whatsapp', 'email'].map((channel) => (
          <section className="panel" key={channel}>
            <span className="message-channel-icon">
              <Icon name={channel === 'email' ? 'note' : 'chat'} size={25} />
            </span>
            <h3>{channel === 'email' ? 'Email' : 'WhatsApp'}</h3>
            <p>
              {channel === 'email'
                ? 'Write from your authorized work mailbox when connected.'
                : 'Use the company business WhatsApp sender when connected.'}
            </p>
            <div className="message-channel-status">
              <span>{user.channelAccess[channel] ? 'Allowed' : 'Not allowed'}</span>
              <span className="team-connection-state">Not connected</span>
            </div>
            <Button
              variant="light"
              disabled={!user.channelAccess[channel]}
              onClick={() => startMessage(null, channel)}
            >
              Start {channel === 'email' ? 'email' : 'WhatsApp'} message
            </Button>
          </section>
        ))}
      </div>
      <section className="panel messages-guide">
        <h3>One message, one or several recipients</h3>
        <ol>
          <li>
            <strong>Choose your channel</strong>
            <span>Email and WhatsApp use separate recipient lists.</span>
          </li>
          <li>
            <strong>Add the people</strong>
            <span>
              Paste addresses or numbers separated by commas or new lines. Duplicate recipients are
              removed.
            </span>
          </li>
          <li>
            <strong>Write and review</strong>
            <span>Check every recipient and the message before delivery is connected.</span>
          </li>
        </ol>
        <div className="team-notice">
          <Icon name="info" size={18} />
          <p>
            This is the messaging frontend preview. No messages are sent and no incoming
            conversations are connected. Live delivery and conversation history come with sender
            connections.
          </p>
        </div>
      </section>
    </div>
  );
}
