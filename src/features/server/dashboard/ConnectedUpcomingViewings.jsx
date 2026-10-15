import React from 'react';
import { get } from '../../../lib/records.js';
import { TitleSection } from '../../../components/ui/TitleSection.jsx';
import { Icon } from '../../../components/ui/Icon.jsx';
import { useNavigation, useWorkspaceActions } from '../../../hooks/useWorkspace.js';
import { viewingClock } from './upcomingModel.js';
import './upcoming-viewings.css';

function DateChip({ value }) {
  const date = new Date(value);
  return (
    <span className="date-chip">
      <b>{date.getDate()}</b>
      <small>{date.toLocaleDateString('en-AE', { month: 'short' })}</small>
    </span>
  );
}

/** Another agent's viewing on the caller's listing: time, property and agent only; never opens. */
function HeldViewing({ entry, propertyName }) {
  const agent = entry.agentName ? `Booked by ${entry.agentName}` : 'Unassigned';
  return (
    <div className="viewing-mini viewing-mini-held">
      <DateChip value={entry.at} />
      <div>
        <strong>{propertyName(entry.propertyId)}</strong>
        <span>
          {viewingClock(entry.at)} · {agent}
        </span>
      </div>
    </div>
  );
}

/**
 * Connected "Upcoming viewings": the caller's own viewings open their record; other agents'
 * viewings on a held listing are shown as plain, non-interactive rows.
 */
export function ConnectedUpcomingViewings({ entries, clientName, propertyName }) {
  const { navigate } = useNavigation();
  const { dispatchRow } = useWorkspaceActions();
  const held = entries.some((entry) => entry.kind === 'held');
  return (
    <section className="panel next-viewings">
      <TitleSection
        heading="Upcoming viewings"
        caption={
          held
            ? 'Your next appointments and others booked on your listings'
            : 'Your next scheduled appointments'
        }
      />
      <div className="viewing-list">
        {entries.map((entry, index) =>
          entry.kind === 'held' ? (
            <HeldViewing key={index} entry={entry} propertyName={propertyName} />
          ) : (
            <button
              key={index}
              onClick={() => dispatchRow('Viewings', entry.record)}
              className="viewing-mini"
            >
              <DateChip value={entry.at} />
              <div>
                <strong>{propertyName(get(entry.record, 'Property ID'))}</strong>
                <span>{clientName(get(entry.record, 'Client ID'))}</span>
              </div>
              <Icon name="chevron" size={16} />
            </button>
          ),
        )}
        {!entries.length && <div className="mini-quiet">No upcoming viewings yet.</div>}
      </div>
      {held && (
        <small className="viewing-held-note">Client details stay with the responsible agent.</small>
      )}
      <button className="panel-link" onClick={() => navigate('Viewings')}>
        Manage viewings <Icon name="arrow" size={16} />
      </button>
    </section>
  );
}
