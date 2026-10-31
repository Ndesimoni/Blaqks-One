import React from 'react';
import { clName, get, prName } from '../../lib/records.js';
import { TitleSection } from '../../components/ui/TitleSection.jsx';
import { Icon } from '../../components/ui/Icon.jsx';
import { useNavigation, useWorkspaceActions } from '../../hooks/useWorkspace.js';

/** Optional name callbacks label hidden linked records in connected mode. */
export function UpcomingViewings({
  data,
  summary,
  clientName = (id) => clName(data, id),
  propertyName = (id) => prName(data, id),
}) {
  const { navigate } = useNavigation();
  const { dispatchRow } = useWorkspaceActions();
  return (
    <section className="panel next-viewings">
      <TitleSection heading="Upcoming viewings" caption="Your next scheduled appointments" />
      <div className="viewing-list">
        {summary.upcoming.slice(0, 3).map((v, i) => (
          <button key={i} onClick={() => dispatchRow('Viewings', v)} className="viewing-mini">
            <span className="date-chip">
              <b>{new Date(get(v, 'Appointment date & time')).getDate()}</b>
              <small>
                {new Date(get(v, 'Appointment date & time')).toLocaleDateString('en-AE', {
                  month: 'short',
                })}
              </small>
            </span>
            <div>
              <strong>{propertyName(get(v, 'Property ID'))}</strong>
              <span>{clientName(get(v, 'Client ID'))}</span>
            </div>
            <Icon name="chevron" size={16} />
          </button>
        ))}
        {!summary.upcoming.length && <div className="mini-quiet">No upcoming viewings yet.</div>}
      </div>
      <button className="panel-link" onClick={() => navigate('Viewings')}>
        Manage viewings <Icon name="arrow" size={16} />
      </button>
    </section>
  );
}
