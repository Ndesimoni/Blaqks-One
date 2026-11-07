import React from 'react';

/** Placeholder cards while the account loads; the status text is announced once. */
export function ProfileSkeleton() {
  return (
    <div className="page-stack acct-page">
      <p className="sr-only" role="status">
        Loading your account…
      </p>
      <div className="profile-grid" aria-hidden="true">
        {[0, 1].map((card) => (
          <div className="panel profile-card acct-card-body" key={card}>
            <span className="acct-skeleton acct-skeleton-line short" />
            <span className="acct-skeleton acct-skeleton-line" />
            <span className="acct-skeleton acct-skeleton-line" />
          </div>
        ))}
      </div>
    </div>
  );
}
