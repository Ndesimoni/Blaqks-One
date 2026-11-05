import React from 'react';
import { Badge } from '../../../components/ui/Badge.jsx';
import { useI18n } from '../../../i18n/useI18n.js';
import { today } from '../../../lib/dates.js';
import { stageTone } from './clientsModel.js';

/** A client's stage as the grid's pill, toned by how far it has come (Lost in red). */
export function StagePill({ stage }) {
  const { t } = useI18n();
  return <Badge tone={stageTone(stage)}>{t(`platformClients.stage.${stage}`)}</Badge>;
}

/** The next follow-up date; one already past reads as due. */
export function FollowUpDate({ value }) {
  const { format } = useI18n();
  if (!value) return <span className="muted">—</span>;
  const due = value < today();
  return (
    <time dateTime={value} className={due ? 'platform-client-due' : undefined}>
      {format.date(value)}
    </time>
  );
}

/** Who the client is assigned to, or a quiet "Unassigned". */
export function OwnerName({ client }) {
  const { t } = useI18n();
  return client.ownerName ? (
    client.ownerName
  ) : (
    <span className="muted">{t('platformClients.unassigned')}</span>
  );
}

/** Where the client came from, in words. */
export function SourceName({ source }) {
  const { t } = useI18n();
  return t(`platformClients.source.${source}`);
}
