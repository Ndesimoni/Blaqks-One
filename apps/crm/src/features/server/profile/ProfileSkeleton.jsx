import React from 'react';

/** Placeholder layout while the account loads; the status text is announced once. */
export function ProfileSkeleton() {
  return (
    <div className="page-stack acct-page">
      <p className="sr-only" role="status">
        Loading your account…
      </p>
      <div className="panel acct-header" aria-hidden="true">
        <span className="acct-avatar acct-skeleton" />
        <div className="acct-identity">
          <span className="acct-skeleton acct-skeleton-line" />
          <span className="acct-skeleton acct-skeleton-line short" />
        </div>
      </div>
      <div className="acct-sections" aria-hidden="true">
        {[0, 1].map((row) => (
          <div className="acct-row" key={row}>
            <div className="acct-row-intro">
              <span className="acct-skeleton acct-skeleton-line short" />
            </div>
            <div className="panel acct-card acct-card-body">
              <span className="acct-skeleton acct-skeleton-line" />
              <span className="acct-skeleton acct-skeleton-line" />
              <span className="acct-skeleton acct-skeleton-line short" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
