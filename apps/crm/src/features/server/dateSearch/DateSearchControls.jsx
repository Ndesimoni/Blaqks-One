import React from 'react';

export const RANGE_ERROR_ID = 'date-range-error';

/** Record type and date range. An inverted range marks the To date and explains the fix. */
export function DateSearchControls({ types, type, filter, setFilter, invalidRange }) {
  const change = (name) => (event) => setFilter((f) => ({ ...f, [name]: event.target.value }));
  return (
    <section className="panel ds-controls" aria-label="Date search filters">
      <div className="field ds-type">
        <label htmlFor="date-record-type">Record type</label>
        <select id="date-record-type" value={type?.title || ''} onChange={change('type')}>
          {types.map((t) => (
            <option key={t.title}>{t.title}</option>
          ))}
        </select>
      </div>
      <div className="field">
        <label htmlFor="date-start">From date</label>
        <input type="date" id="date-start" value={filter.start} onChange={change('start')} />
      </div>
      <div className="field">
        <label htmlFor="date-end">To date</label>
        <input
          type="date"
          id="date-end"
          value={filter.end}
          aria-invalid={invalidRange || undefined}
          aria-describedby={invalidRange ? RANGE_ERROR_ID : undefined}
          onChange={change('end')}
        />
      </div>
      {invalidRange && (
        <p id={RANGE_ERROR_ID} className="field-error ds-range-error" role="alert">
          The end date must be on or after the start date.
        </p>
      )}
    </section>
  );
}
