import React from 'react';
import { Badge } from '../../../components/ui/Badge.jsx';
import { Button } from '../../../components/ui/Button.jsx';
import { connectionSummary, healthTone } from './channelModel.js';

/**
 * One channel as the approved mockup's connection card (design queue item 17): its name, a
 * status pill, one line (what it does, or which account is connected) and Connect or Manage,
 * which opens the channel's panel.
 */
export function ChannelCard({ entry, connections, t, onOpen }) {
  const live = connections[0];
  const titleId = `channel-${entry.channel}`;
  return (
    <article className="panel channel-card" aria-labelledby={titleId}>
      <h2 id={titleId}>{t(`channels.channel.${entry.channel}`)}</h2>
      {live ? (
        <Badge tone={healthTone(live.health)}>{t(`channels.status.${live.state}`)}</Badge>
      ) : (
        <Badge tone="slate">{t('channels.status.none')}</Badge>
      )}
      <p className="channels-muted">
        {live
          ? connections.map((connection) => connectionSummary(connection, t)).join(' · ')
          : t(`channels.channel.${entry.channel}Note`)}
      </p>
      <span>
        <Button variant="light" onClick={onOpen}>
          {live ? t('channels.manage') : t('channels.connect')}
        </Button>
      </span>
    </article>
  );
}
