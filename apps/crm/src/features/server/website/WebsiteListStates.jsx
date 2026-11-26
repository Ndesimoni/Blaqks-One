import React from 'react';
import { Button } from '../../../components/ui/Button.jsx';
import { Empty } from '../../../components/ui/Empty.jsx';
import './website-list-states.css';

/** Placeholder rows while a website list loads; the status text is announced once. */
export function ListSkeleton({ label, rows = 4 }) {
  return (
    <section className="panel website-list-skeleton">
      <p className="sr-only" role="status">
        {label}
      </p>
      {Array.from({ length: rows }, (_, row) => (
        <div className="website-skeleton-row" key={row} aria-hidden="true">
          <span className="website-skeleton-lines">
            <span className="website-skeleton" />
            <span className="website-skeleton short" />
          </span>
          <span className="website-skeleton website-skeleton-chip" />
        </div>
      ))}
    </section>
  );
}

export function ListError({ message, retryLabel, onRetry }) {
  return (
    <section className="panel recovery-panel" role="alert">
      <p className="field-error">{message}</p>
      <Button variant="light" onClick={onRetry}>
        {retryLabel}
      </Button>
    </section>
  );
}

/** "No records yet" and "no matches" read differently; only no matches offers Clear. */
export function ListEmpty({ title, detail, icon = 'building', action }) {
  return (
    <section className="panel website-list-empty">
      <Empty title={title} detail={detail} icon={icon} action={action} />
    </section>
  );
}
