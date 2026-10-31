import React from 'react';
import { Button } from '../../../components/ui/Button.jsx';
import { Empty } from '../../../components/ui/Empty.jsx';
import { Icon } from '../../../components/ui/Icon.jsx';
import { TitleSection } from '../../../components/ui/TitleSection.jsx';
import { readableDate } from '../../../lib/dates.js';
import { DateResultGroups } from './DateResultGroups.jsx';
import { countText, typeIcon } from './resultGroups.js';

function Loading() {
  return (
    <section className="panel ds-results" aria-label="Matching records">
      <div className="ds-skeleton" role="status">
        <span className="sr-only">Loading finance records…</span>
        {[0, 1, 2].map((row) => (
          <span key={row} aria-hidden="true" />
        ))}
      </div>
    </section>
  );
}

function emptyState(invalidRange) {
  return invalidRange ? (
    <Empty
      title="Check the date range"
      detail="Choose a To date on or after the From date to see results."
      icon="calendar"
    />
  ) : (
    <Empty
      title="No records in this range"
      detail="Change the record type or expand the dates to explore more results."
      icon="calendar"
    />
  );
}

export function DateSearchResults({ type, filter, rows, onOpen, finance, invalidRange }) {
  if (finance?.loading && !finance.overview) return <Loading />;
  if (finance && !finance.overview)
    return (
      <section className="panel recovery-panel">
        <p className="field-error" role="alert">
          {finance.error || 'Finance records could not be loaded.'}
        </p>
        <Button onClick={finance.retry}>Retry</Button>
      </section>
    );
  const range = `${readableDate(filter.start)} to ${readableDate(filter.end)}`;
  return (
    <section className="panel ds-results" aria-label="Matching records">
      <TitleSection
        heading="Matching records"
        caption={`${range} · oldest first`}
        action={
          <div className="ds-summary">
            <span className="ds-type-badge">
              <Icon name={typeIcon(type)} size={14} />
              {type?.title || 'No record types'}
            </span>
            <span className="ds-count" role="status">
              {countText(rows.length)}
            </span>
          </div>
        }
      />
      {rows.length ? (
        <DateResultGroups
          key={JSON.stringify(filter)}
          rows={rows}
          icon={typeIcon(type)}
          onOpen={onOpen}
        />
      ) : (
        emptyState(invalidRange)
      )}
    </section>
  );
}
