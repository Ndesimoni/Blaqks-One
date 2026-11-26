import React from 'react';
import { useI18n } from '../../../i18n/useI18n.js';
import { FollowUpDate, OwnerName } from './ClientCells.jsx';

/** One label and value in the facts card, as the CRM slider lists them. */
function Fact({ label, children }) {
  return (
    <div className="detail-field">
      <span>{label}</span>
      <strong>{children}</strong>
    </div>
  );
}

/**
 * The client's facts and notes, in the CRM slider's cards: contact, phone, email, source,
 * who it is assigned to, the next follow-up, the company it signed up as (once linked) and
 * when it was added. Phone and email are plain text here; the header's links contact them.
 */
export function ClientFacts({ client }) {
  const { t, format } = useI18n();
  const k = (key, vars) => t(`platformClients.${key}`, vars);
  const dash = <span className="muted">—</span>;
  const added = client.createdAt
    ? client.createdByName
      ? k('addedBy', { date: format.date(client.createdAt), name: client.createdByName })
      : format.date(client.createdAt)
    : '';
  return (
    <div className="record-facts">
      <section className="record-facts-section" aria-label={k('details')}>
        <h3>{k('details')}</h3>
        <div className="details-grid">
          <Fact label={k('fact.contact')}>{client.contactName || dash}</Fact>
          <Fact label={k('fact.phone')}>
            {client.phone ? <span className="mono">{client.phone}</span> : dash}
          </Fact>
          <Fact label={k('fact.email')}>{client.email || dash}</Fact>
          <Fact label={k('fact.source')}>{k(`source.${client.source}`)}</Fact>
          <Fact label={k('fact.owner')}>
            <OwnerName client={client} />
          </Fact>
          <Fact label={k('fact.nextFollowUp')}>
            <FollowUpDate value={client.nextFollowUp} />
          </Fact>
          <Fact label={k('fact.linked')}>
            {client.linkedCompany ? (
              client.linkedCompany.name ? (
                k('linked', { company: client.linkedCompany.name })
              ) : (
                k('kind.linked')
              )
            ) : (
              <span className="muted">{k('notLinked')}</span>
            )}
          </Fact>
          {added && <Fact label={k('fact.added')}>{added}</Fact>}
        </div>
      </section>
      <section className="record-facts-section" aria-label={k('notes')}>
        <h3>{k('notes')}</h3>
        {client.notes ? (
          <p className="platform-client-notes">{client.notes}</p>
        ) : (
          <p className="muted platform-client-notes">{k('noNotes')}</p>
        )}
      </section>
    </div>
  );
}
