import React from 'react';
import { TitleSection } from '../../../components/ui/TitleSection.jsx';
import { Icon } from '../../../components/ui/Icon.jsx';
import './client-desk.css';

/**
 * Clients the member reaches only through a follow-up assigned to them (decision 2). The server
 * shares their name, phone and email alone, so nothing else is shown or matched here.
 */
export function TaskClientsPanel({ clients }) {
  if (!clients.length) return null;
  return (
    <section className="panel" aria-label="Clients on your follow-ups">
      <TitleSection
        heading="Clients on your follow-ups"
        caption="Not assigned to you. Only contact details are shared for these follow-ups."
      />
      <ul className="task-client-list">
        {clients.map((client) => (
          <li
            className="assignment-panel"
            key={client.client_id}
            aria-label={client.full_name || client.client_id}
          >
            <div className="assignment-row">
              <span className="assignment-icon" aria-hidden="true">
                <Icon name="person" size={18} />
              </span>
              <div className="assignment-current">
                <strong>{client.full_name || client.client_id}</strong>
                <small>{client.client_id}</small>
              </div>
            </div>
            <dl className="assignment-contact">
              <dt>Phone</dt>
              <dd>{client.phone ? <a href={`tel:${client.phone}`}>{client.phone}</a> : '—'}</dd>
              <dt>Email</dt>
              <dd>{client.email ? <a href={`mailto:${client.email}`}>{client.email}</a> : '—'}</dd>
            </dl>
          </li>
        ))}
      </ul>
    </section>
  );
}
