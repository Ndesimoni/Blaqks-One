import React from 'react';
import { Badge } from '../../../components/ui/Badge.jsx';
import { Button } from '../../../components/ui/Button.jsx';
import { ChannelForm } from './ChannelForm.jsx';
import { ConfirmDisconnect } from './ConfirmDisconnect.jsx';
import { SendgridStatus } from './SendgridStatus.jsx';

const tone = (health) => (health === 'attention' ? 'amber' : health === 'off' ? 'slate' : 'green');

/** One live connection: its state, account hint, actions, and reconnect or disconnect step. */
export function ConnectionRow({ connection, channel, t, busy, form, confirm, handlers }) {
  const { setForm, setConfirm, submit, close, onDisconnect } = handlers;
  const sendgrid = connection.provider === 'sendgrid';
  const hint = String(connection.accountHint);
  return (
    <li>
      <div className="channel-connection-head">
        <strong>{connection.label}</strong>
        <Badge tone={tone(connection.health)}>{t(`channels.status.${connection.state}`)}</Badge>
      </div>
      <small>
        {t(`channels.providerName.${connection.provider}`)} ·{' '}
        {sendgrid
          ? t('channels.sendgrid.domainShown', { domain: connection.domain ?? hint })
          : t('channels.accountEnding', { hint: hint.replace(/^[^0-9a-zA-Z]*/, '') })}
      </small>
      {sendgrid && <SendgridStatus connection={connection} t={t} />}
      {confirm ? (
        <ConfirmDisconnect
          label={connection.label}
          t={t}
          busy={busy}
          body={sendgrid ? t('channels.sendgrid.disconnectBody') : undefined}
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
      {form && (
        <ChannelForm
          mode="reconnect"
          channel={channel}
          provider={connection.provider}
          connection={connection}
          t={t}
          busy={busy}
          onSubmit={submit}
          onClose={close}
        />
      )}
    </li>
  );
}
