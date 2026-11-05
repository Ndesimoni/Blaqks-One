import React from 'react';
import './team-skeleton.css';

/** Placeholder rows while the team loads; the status text is announced once. */
export function TeamDirectorySkeleton() {
  return (
    <section className="panel team-directory-skeleton">
      <p className="sr-only" role="status">
        Loading team…
      </p>
      {[0, 1, 2].map((row) => (
        <div className="team-skeleton-row" key={row} aria-hidden="true">
          <span className="team-skeleton team-skeleton-avatar" />
          <span className="team-skeleton-lines">
            <span className="team-skeleton team-skeleton-line" />
            <span className="team-skeleton team-skeleton-line short" />
          </span>
          <span className="team-skeleton team-skeleton-chip" />
        </div>
      ))}
    </section>
  );
}
