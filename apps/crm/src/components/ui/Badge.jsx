import React from 'react';

function statusClass(val) {
  const s = String(val || '').toLowerCase();
  return /hot|completed|closed|paid|available|confirmed|active|verified|yes|interested/.test(s)
    ? 'green'
    : /overdue|lost|cancelled|expired|no-show|rejected/.test(s)
      ? 'red'
      : /negotiation|in progress|viewing|pending|qualified|warm|under offer/.test(s)
        ? 'amber'
        : 'slate';
}

function Badge({ children, tone }) {
  return (
    <span className={'badge badge-' + (tone || statusClass(children))}>
      <span className="badge-dot" aria-hidden="true" />
      {children || '—'}
    </span>
  );
}

export { Badge, statusClass };
