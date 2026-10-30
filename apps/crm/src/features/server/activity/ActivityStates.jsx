import React from 'react';
import { Icon } from '../../../components/ui/Icon.jsx';

/** Placeholder rows while the first page loads; the status text is announced once. */
export function ActivitySkeleton() {
  return (
    <section className="panel activity-feed" aria-busy="true">
      <p className="sr-only" role="status">
        Loading activity…
      </p>
      <div className="activity-day-head" aria-hidden="true">
        <span className="activity-skeleton is-label" />
      </div>
      <ul className="activity-feed-list" aria-hidden="true">
        {[0, 1, 2, 3, 4].map((row) => (
          <li key={row} className="activity-row">
            <span className="activity-skeleton is-avatar" />
            <span className="activity-skeleton-lines">
              <span className="activity-skeleton is-line" />
              <span className="activity-skeleton is-line is-short" />
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Empty, error, forbidden and invalid-range states; none falls back to demo data. */
export function ActivityMessage({
  icon,
  title,
  children,
  action,
  tone = 'neutral',
  alert = false,
}) {
  return (
    <section
      className={`panel activity-message is-${tone}`}
      aria-live={alert ? undefined : 'polite'}
    >
      <span className="activity-message-icon" aria-hidden="true">
        <Icon name={icon} size={24} />
      </span>
      <h2>{title}</h2>
      <p role={alert ? 'alert' : undefined}>{children}</p>
      {action}
    </section>
  );
}
