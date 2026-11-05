import React from 'react';
import { useI18n } from '../../../i18n/useI18n.js';
import { FollowUpDate, OwnerName, SourceName, StagePill } from './ClientCells.jsx';
import { clientName } from './clientsModel.js';
import '../../records/cards.css';
import '../../records/grid/grid-cards.css';
import '../../records/grid/grid-open.css';

/**
 * Phones: one card per client, as the CRM's record cards. The company and contact lead with
 * the stage beside them, then the next follow-up, who it is assigned to and the source. The
 * company name is the card's button; tapping anywhere on the card opens the client too.
 */
export function ClientCards({ rows, onOpen }) {
  const { t } = useI18n();
  const k = (key, vars) => t(`platformClients.${key}`, vars);
  return (
    <ul className="record-cards platform-client-cards" aria-label={k('table')}>
      {rows.map((client) => (
        <li key={client.id} className="record-card" onClick={() => onOpen(client.id)}>
          <div className="record-card-head">
            <div className="record-card-identity">
              <button
                type="button"
                className="grid-open record-card-title"
                aria-label={k('openNamed', { name: clientName(client) })}
              >
                {clientName(client)}
              </button>
              {client.companyName && client.contactName && (
                <span className="record-card-id">{client.contactName}</span>
              )}
            </div>
            <StagePill stage={client.stage} />
          </div>
          <dl className="record-card-facts">
            <div>
              <dt>{k('col.nextFollowUp')}</dt>
              <dd>
                <FollowUpDate value={client.nextFollowUp} />
              </dd>
            </div>
            <div>
              <dt>{k('col.owner')}</dt>
              <dd>
                <OwnerName client={client} />
              </dd>
            </div>
            <div>
              <dt>{k('col.source')}</dt>
              <dd>
                <SourceName source={client.source} />
              </dd>
            </div>
          </dl>
        </li>
      ))}
    </ul>
  );
}
