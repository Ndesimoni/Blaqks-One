import React from 'react';
import { get } from '../../../lib/records.js';
import { Icon } from '../../../components/ui/Icon.jsx';
import { followUpWhen, viewingWhen } from './agendaModel.js';

/** The time column: a day (or due state) above an optional time or date. */
function When({ day, detail, alert = false }) {
  return (
    <span className={alert ? 'agenda-when agenda-when-alert' : 'agenda-when'}>
      <b>{day || '—'}</b>
      {detail && <small>{detail}</small>}
    </span>
  );
}

const Type = ({ tone, children }) => (
  <span className={`v2-chip agenda-type${tone ? ` v2-chip-${tone}` : ''}`}>{children}</span>
);

/** A follow-up the member can open: due state, next action, client and a type label. */
export function FollowUpRow({ task, today, clientName, onOpen }) {
  const when = followUpWhen(task, today);
  return (
    <li>
      <button type="button" className="agenda-row" onClick={onOpen}>
        <When day={when.label} detail={when.detail} alert={when.overdue} />
        <span className="agenda-main">
          <strong>{get(task, 'Next action') || 'Contact client'}</strong>
          <span>{clientName(get(task, 'Client ID'))}</span>
        </span>
        <Type tone={when.overdue ? 'amber' : 'blue'}>Follow-up</Type>
      </button>
    </li>
  );
}

/** The caller's own viewing: opens its record. */
export function ViewingRow({ entry, today, clientName, propertyName, onOpen }) {
  const when = viewingWhen(entry.at, today);
  return (
    <li>
      <button type="button" className="agenda-row" onClick={onOpen}>
        <When day={when.day} detail={when.time} />
        <span className="agenda-main">
          <strong>{propertyName(get(entry.record, 'Property ID'))}</strong>
          <span>{clientName(get(entry.record, 'Client ID'))}</span>
        </span>
        <Type tone="accent">Viewing</Type>
      </button>
    </li>
  );
}

/** Another agent's viewing on the caller's listing: time, property and agent only; never opens. */
export function HeldViewingRow({ entry, today, propertyName }) {
  const when = viewingWhen(entry.at, today);
  const agent = entry.agentName ? `Booked by ${entry.agentName}` : 'Unassigned';
  return (
    <li>
      <div className="agenda-row agenda-row-held">
        <When day={when.day} detail={when.time} />
        <span className="agenda-main">
          <strong>{propertyName(entry.propertyId)}</strong>
          <span>{agent}</span>
        </span>
        <Icon name="lock" size={14} className="agenda-lock" />
        <Type tone="accent">Viewing</Type>
      </div>
    </li>
  );
}
