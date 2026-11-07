import React, { useId } from 'react';
import { Icon } from '../../../components/ui/Icon.jsx';
import { useRecords } from '../../../hooks/useWorkspace.js';

/** Decision 2: name, phone and email only, for a client on a follow-up assigned to the caller. */
export function TaskClientCard({ record }) {
  const headingId = useId();
  const { taskClients = [] } = useRecords();
  const client = record.client_id && taskClients.find((row) => row.client_id === record.client_id);
  if (!client) return null;
  return (
    <section className="assignment-panel" aria-labelledby={headingId}>
      <div className="assignment-row">
        <span className="assignment-icon" aria-hidden="true">
          <Icon name="person" size={18} />
        </span>
        <div className="assignment-current">
          <h3 id={headingId}>Client contact</h3>
          <strong>{client.full_name || client.client_id}</strong>
          <small>
            {client.client_id} · Not assigned to you. Only contact details are shared for this
            follow-up.
          </small>
        </div>
      </div>
      <dl className="assignment-contact">
        <dt>Phone</dt>
        <dd>{client.phone ? <a href={`tel:${client.phone}`}>{client.phone}</a> : '—'}</dd>
        <dt>Email</dt>
        <dd>{client.email ? <a href={`mailto:${client.email}`}>{client.email}</a> : '—'}</dd>
      </dl>
    </section>
  );
}
