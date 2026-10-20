import React, { useState } from 'react';
import { Badge } from '../../../components/ui/Badge.jsx';
import { Button } from '../../../components/ui/Button.jsx';
import { Icon } from '../../../components/ui/Icon.jsx';
import { ChannelForm } from './ChannelForm.jsx';
import { ConfirmDisconnect } from './ConfirmDisconnect.jsx';

const tone = (health) => (health === 'attention' ? 'amber' : health === 'off' ? 'slate' : 'green');

/**
 * One channel with its live connections, form and disconnect confirmation. A channel
 * holds one live connection per company (email: per member), so Connect appears only
 * when none is live; disconnected rows stay as server history and are not listed.
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
    const done =
      form === 'connect' ? await onConnect(entry.channel, body) : await onReconnect(form, body);
    if (done) close();
  };
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
            <li key={connection.id}>
              <div className="channel-connection-head">
                <strong>{connection.label}</strong>
                <Badge tone={tone(connection.health)}>
                  {t(`channels.status.${connection.state}`)}
                </Badge>
              </div>
              <small>
                {t(`channels.providerName.${connection.provider}`)} ·{' '}
                {t('channels.accountEnding', {
                  hint: String(connection.accountHint).replace(/^[^0-9a-zA-Z]*/, ''),
                })}
              </small>
              {confirm === connection.id ? (
                <ConfirmDisconnect
                  label={connection.label}
                  t={t}
                  busy={busy}
                  onCancel={() => setConfirm(null)}
                  onConfirm={async () => {
                    if (await onDisconnect(connection)) setConfirm(null);
                  }}
                />
              ) : (
                <div className="channel-actions">
                  <Button variant="light" disabled={busy} onClick={() => setForm(connection)}>
                    {t('channels.reconnect')}
                  </Button>
                  <Button variant="light" disabled={busy} onClick={() => setConfirm(connection.id)}>
                    {t('channels.disconnect')}
                  </Button>
                </div>
              )}
              {form && form !== 'connect' && form.id === connection.id && (
                <ChannelForm
                  mode="reconnect"
                  channel={entry.channel}
                  provider={connection.provider}
                  connection={connection}
                  t={t}
                  busy={busy}
                  onSubmit={submit}
                  onClose={close}
                />
              )}
            </li>
          ))}
        </ul>
      )}
      {form === 'connect' ? (
        <ChannelForm
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
