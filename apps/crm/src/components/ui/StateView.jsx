import React from 'react';
import { Icon } from './Icon.jsx';
import './state-view.css';

/**
 * A whole-page state from the approved mockup (empty, error, no access): a soft icon tile, the
 * heading, one line of help (and an optional `note`) and the actions, centred. `tone="error"`
 * marks a failure.
 */
export function StateView({ icon = 'note', title, detail, note, tone, role, label, children }) {
  return (
    <section
      className={'state-view' + (tone ? ` state-view-${tone}` : '')}
      role={role}
      aria-label={label}
    >
      <span className="state-view-icon" aria-hidden="true">
        <Icon name={icon} size={28} />
      </span>
      <h2>{title}</h2>
      {detail && <p>{detail}</p>}
      {note && <p className="state-view-note">{note}</p>}
      {children && <div className="state-view-actions">{children}</div>}
    </section>
  );
}

/** Loading as the mockup's skeleton: soft rows that shimmer unless motion is reduced. */
export function StateSkeleton({ label, rows = 5 }) {
  return (
    <div className="state-skeleton" role="status" aria-label={label}>
      <span className="sr-only">{label}</span>
      {Array.from({ length: rows }, (_, index) => (
        <span key={index} aria-hidden="true" />
      ))}
    </div>
  );
}
