import React from 'react';

/** A quiet placeholder of the page's summary and rows while `GET /finance` loads. */
export function FinanceSkeleton({ noun }) {
  return (
    <div className="page-stack finance-page finance-skeleton" role="status">
      <span className="sr-only">Loading {noun}…</span>
      <span className="finance-skeleton-block is-head" aria-hidden="true" />
      <span className="finance-skeleton-block is-filters" aria-hidden="true" />
      <span className="finance-skeleton-table" aria-hidden="true">
        {[0, 1, 2, 3, 4].map((row) => (
          <span key={row} className="finance-skeleton-block is-row" />
        ))}
      </span>
    </div>
  );
}
