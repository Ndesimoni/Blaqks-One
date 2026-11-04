import React, { useState } from 'react';
import { Button } from '../../../components/ui/Button.jsx';
import { useSession } from '../../../hooks/useSession.js';
import { useWorkspaceScope } from '../../../hooks/useWorkspaceScope.js';
import { useI18n } from '../../../i18n/useI18n.js';
import { ChannelCard } from './ChannelCard.jsx';
import { CHANNELS } from './channelModel.js';
import { ChannelPanel } from './ChannelPanel.jsx';
import { useChannels } from './useChannels.js';
import './channel-panel.css';
import './channels.css';
import './sendgrid.css';
import './whatsapp.css';

/**
 * Connected Channels settings as the approved mockup (design queue item 17): Admin-only
 * connection cards, each opening its panel to connect, reconnect or disconnect and, for
 * WhatsApp and company email, to give members numbers and addresses.
 */
export function ServerChannels() {
  const { api, user } = useSession();
  const { owner } = useWorkspaceScope();
  const { t } = useI18n();
  const { channels, error, reload, notice, setNotice } = useChannels(api, owner.id);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(null);
  if (user.roleId !== 'admin')
    return (
      <section className="panel recovery-panel">
        <h2>{t('channels.title')}</h2>
        <p>{t('channels.adminOnly')}</p>
      </section>
    );
  // Resolves to '' on success or the reason. A Twilio form shows its own refusal beside the
  // fields (`inline`), so the page notice does not repeat it.
  const run = async (action, key, values, inline = false) => {
    setBusy(true);
    setNotice('');
    try {
      await action();
      setNotice(t(key, values));
      reload();
      return '';
    } catch (failure) {
      if (!inline) setNotice(failure.message);
      return failure.message || t('whatsappAccount.failed');
    } finally {
      setBusy(false);
    }
  };
  const connect = (channel, body) =>
    run(
      () => api.connectChannel(owner.id, { connection: body }),
      'channels.connectedNotice',
      { label: body.label },
      body.provider === 'twilio',
    );
  const reconnect = (connection, body) =>
    run(
      () => api.reconnectChannel(owner.id, connection.id, body),
      'channels.reconnectedNotice',
      { label: connection.label },
      connection.provider === 'twilio',
    );
  const disconnect = (connection) =>
    run(
      () => api.disconnectChannel(owner.id, connection.id, { expectedVersion: connection.version }),
      'channels.disconnectedNotice',
      { label: connection.label },
    );
  if (error)
    return (
      <section className="panel recovery-panel" role="alert">
        <p className="field-error">{error || t('channels.loadError')}</p>
        <Button onClick={reload}>{t('channels.retry')}</Button>
      </section>
    );
  if (!channels)
    return (
      <p role="status" className="channels-muted">
        {t('channels.loading')}
      </p>
    );
  const page = { api, workspaceId: owner.id, user, t, busy, notice, onConnect: connect };
  Object.assign(page, { onReconnect: reconnect, onDisconnect: disconnect });
  const liveOf = (channel) =>
    channels.filter((row) => row.channel === channel && row.state !== 'disconnected');
  const opened = CHANNELS.find((entry) => entry.channel === open);
  return (
    <div className="page-stack channels-page">
      <p className="channels-intro">{t('channels.intro')}</p>
      {channels.some((row) => row.state === 'reconnect_required') && (
        <div className="channels-banner" role="status">
          {t('channels.banner')}
        </div>
      )}
      <div aria-live="polite">
        {notice && !opened && (
          <p className="channels-notice" role="status">
            {notice}
          </p>
        )}
      </div>
      <div className="channels-grid">
        {CHANNELS.map((entry) => (
          <ChannelCard
            key={entry.channel}
            entry={entry}
            connections={liveOf(entry.channel)}
            t={t}
            onOpen={() => {
              setNotice('');
              setOpen(entry.channel);
            }}
          />
        ))}
      </div>
      {opened && (
        <ChannelPanel
          entry={opened}
          connections={liveOf(opened.channel)}
          page={page}
          onClose={() => setOpen(null)}
        />
      )}
    </div>
  );
}
