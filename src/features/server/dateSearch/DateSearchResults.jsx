import React from 'react';
import { Button } from '../../../components/ui/Button.jsx';
import { Empty } from '../../../components/ui/Empty.jsx';
import { Icon } from '../../../components/ui/Icon.jsx';
import { OverflowList } from '../../../components/ui/OverflowList.jsx';
import { TitleSection } from '../../../components/ui/TitleSection.jsx';
import { readableDate } from '../../../lib/dates.js';

export function DateSearchResults({ type, filter, rows, onOpen, finance }) {
  if (finance?.loading && !finance.overview)
    return (
      <p role="status" className="panel">
        Loading finance records…
      </p>
    );
  if (finance && !finance.overview)
    return (
      <section className="panel recovery-panel">
        <p className="field-error" role="alert">
          {finance.error || 'Finance records could not be loaded.'}
        </p>
        <Button onClick={finance.retry}>Retry</Button>
      </section>
    );
  return (
    <div className="panel">
      <TitleSection
        heading="Matching records"
        caption={`${type?.title || 'No record types'} · ${readableDate(filter.start)} to ${readableDate(filter.end)}`}
      />
      <OverflowList
        mode="scroll"
        className="record-results-list"
        key={JSON.stringify(filter)}
        items={rows}
        getKey={(row) => row.key}
        label="Date search matches"
        listClassName="date-result-list"
        renderItem={(row, _index, { close }) => (
          <button
            type="button"
            className="result-row"
            onClick={() => {
              close();
              onOpen(row);
            }}
          >
            <span className="result-icon">
              <Icon name="calendar" size={18} />
            </span>
            <div>
              <strong>{row.title}</strong>
              <small>{row.subtitle}</small>
            </div>
            <div className="result-date">{readableDate(row.date)}</div>
            <Icon name="arrow" size={17} />
          </button>
        )}
        after={
          !rows.length && (
            <Empty
              title="No records in this range"
              detail="Change the record type or expand the dates to explore more results."
              icon="calendar"
            />
          )
        }
      />
    </div>
  );
}
