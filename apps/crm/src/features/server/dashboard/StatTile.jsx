import React from 'react';
import { useNavigation } from '../../../hooks/useWorkspace.js';
import './chart-tokens.css';
import './dashboard-kpis.css';

/**
 * One stat tile (dataviz contract: label, value, note, optional trend as `children`) for the
 * Dashboard and Performance. With `route` it is a button that opens the page behind the figure.
 */
export function StatTile({ label, value, note, tone = '', route, children }) {
  const { navigate } = useNavigation();
  const body = (
    <>
      <span className="kpi-label">{label}</span>
      <span className="kpi-row">
        <strong className="kpi-value">{value}</strong>
        {children}
      </span>
      {note && <span className={'kpi-note' + (tone ? ` is-${tone}` : '')}>{note}</span>}
    </>
  );
  return route ? (
    <button type="button" className="kpi-tile" onClick={() => navigate(route)}>
      {body}
    </button>
  ) : (
    <div className="kpi-tile is-static">{body}</div>
  );
}
