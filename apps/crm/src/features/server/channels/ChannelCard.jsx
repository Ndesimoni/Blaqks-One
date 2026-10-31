import React, { useState } from 'react';
import { Button } from '../../../components/ui/Button.jsx';
import { Icon } from '../../../components/ui/Icon.jsx';
import { ChannelForm } from './ChannelForm.jsx';
import { ConnectionRow } from './ConnectionRow.jsx';
import { TwilioForm } from './TwilioForm.jsx';

/**
 * One channel with its live connections, form and disconnect confirmation. A channel
 * holds one live connection per company (email: per member), so Connect appears only
 * when none is live; disconnected rows stay as server history and are not listed. Each
 * handler resolves to '' on success or the reason it failed.
 */
export function ChannelCard({ entry, connections, t, busy, onConnect, onReconnect, onDisconnect }) {
  const [form, setForm] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const channelName = t(`channels.channel.${entry.channel}`);
  const close = () => {
    setForm(null);
    setConfirm(null);
  };
  const submit = async (body) => {
    const failure =
      form === 'connect' ? await onConnect(entry.channel, body) : await onReconnect(form, body);
    if (!failure) close();
    return failure;
  };
  const ConnectForm = entry.provider === 'twilio' ? TwilioForm : ChannelForm;
  const handlers = { setForm, setConfirm, submit, close, onDisconnect };
  return (
    <article className="channel-card" aria-labelledby={`channel-${entry.channel}`}>
      <header className="channel-head">
        <span className="channel-icon" aria-hidden="true">
          <Icon name={entry.icon} size={20} />
        </span>
        <div>
          <h2 id={`channel-${entry.channel}`}>{channelName}</h2>
          <p>{t(`channels.channel.${entry.channel}Note`)}</p>
        </div>
      </header>
      {connections.length === 0 ? (
        <p className="channels-muted">{t('channels.notConnected')}</p>
      ) : (
        <ul className="channel-connections">
          {connections.map((connection) => (
            <ConnectionRow
              key={connection.id}
              connection={connection}
              channel={entry.channel}
              t={t}
              busy={busy}
              form={form && form !== 'connect' && form.id === connection.id}
              confirm={confirm === connection.id}
              handlers={handlers}
            />
          ))}
        </ul>
      )}
      {form === 'connect' ? (
        <ConnectForm
          mode="connect"
          channel={entry.channel}
          provider={entry.provider}
          t={t}
          busy={busy}
          onSubmit={submit}
          onClose={close}
        />
      ) : (
        connections.length === 0 && (
          <Button variant="light" icon="plus" disabled={busy} onClick={() => setForm('connect')}>
            {t('channels.connect')}
          </Button>
        )
      )}
    </article>
  );
}
