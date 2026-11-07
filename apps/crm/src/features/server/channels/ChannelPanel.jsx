import React, { useState } from 'react';
import { Badge } from '../../../components/ui/Badge.jsx';
import { Button } from '../../../components/ui/Button.jsx';
import { Drawer } from '../../../components/ui/Drawer.jsx';
import { ChannelForm } from './ChannelForm.jsx';
import { healthTone } from './channelModel.js';
import { ConnectionRow } from './ConnectionRow.jsx';
import { SendingAddresses } from './SendingAddresses.jsx';
import { TwilioForm } from './TwilioForm.jsx';
import { WhatsappNumbers } from './WhatsappNumbers.jsx';
import { WhatsappTemplates } from './WhatsappTemplates.jsx';

/**
 * A channel's panel from the right edge (the approved mockup's channel slider, design queue
 * item 17). With nothing live it holds the connect form; once connected, the account with
 * Reconnect and Disconnect, then the members' WhatsApp numbers and the account's templates
 * (Twilio) or sending addresses
 * (SendGrid). A channel holds one live connection per company; each handler resolves to ''
 * on success or the reason it failed.
 */
export function ChannelPanel({ entry, connections, page, onClose }) {
  const { api, workspaceId, user, t, busy, notice, onConnect, onReconnect, onDisconnect } = page;
  const [form, setForm] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const channelName = t(`channels.channel.${entry.channel}`);
  const titleId = `channel-panel-${entry.channel}`;
  const live = connections[0];
  const close = () => {
    setForm(null);
    setConfirm(null);
  };
  const submit = async (body) => {
    const failure = live ? await onReconnect(form, body) : await onConnect(entry.channel, body);
    if (!failure) close();
    return failure;
  };
  const ConnectForm = entry.provider === 'twilio' ? TwilioForm : ChannelForm;
  const handlers = { setForm, setConfirm, submit, close, onDisconnect };
  const twilio = connections.find((row) => row.provider === 'twilio');
  const sendgrid = connections.find((row) => row.provider === 'sendgrid');
  return (
    <Drawer placement="right" className="channel-panel" titleId={titleId} onClose={onClose}>
      <div className="channel-panel-head">
        <div>
          <h2 id={titleId}>{channelName}</h2>
          <Badge tone={live ? healthTone(live.health) : 'slate'}>
            {t(live ? `channels.status.${live.state}` : 'channels.status.none')}
          </Badge>
        </div>
        <Button
          variant="light"
          icon="close"
          aria-label={t('channels.closePanel', { channel: channelName })}
          onClick={onClose}
        />
      </div>
      <div className="channel-panel-body">
        <div aria-live="polite">
          {notice && (
            <p className="channels-notice" role="status">
              {notice}
            </p>
          )}
        </div>
        {live ? (
          <ul className="panel channel-connections">
            {connections.map((connection) => (
              <ConnectionRow
                key={connection.id}
                connection={connection}
                channel={entry.channel}
                t={t}
                busy={busy}
                form={form && form.id === connection.id}
                confirm={confirm === connection.id}
                handlers={handlers}
              />
            ))}
          </ul>
        ) : (
          <div className="panel channel-connect">
            <p className="channels-muted">{t(`channels.channel.${entry.channel}Note`)}</p>
            <ConnectForm
              mode="connect"
              channel={entry.channel}
              provider={entry.provider}
              t={t}
              busy={busy}
              onSubmit={submit}
              onClose={onClose}
            />
          </div>
        )}
        {twilio && (
          <WhatsappNumbers
            api={api}
            workspaceId={workspaceId}
            connection={twilio}
            admin={user}
            t={t}
          />
        )}
        {twilio && (
          <WhatsappTemplates api={api} workspaceId={workspaceId} connection={twilio} t={t} />
        )}
        {sendgrid && (
          <SendingAddresses
            api={api}
            workspaceId={workspaceId}
            connection={sendgrid}
            admin={user}
            t={t}
          />
        )}
      </div>
    </Drawer>
  );
}
