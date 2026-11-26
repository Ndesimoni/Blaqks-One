import React from 'react';
import { Button } from '../../../components/ui/Button.jsx';

export const RANGE_ERROR_ID = 'date-range-error';

/**
 * The approved mockup's date search form (`form-card`): From, To and the records to search, then
 * Clear and Search. Changes wait in `draft` until Search (or Enter); Clear returns to the last
 * 30 days. An inverted searched range marks the To date and explains the fix.
 */
export function DateSearchControls({ types, draft, setDraft, onSearch, onClear, invalidRange }) {
  const change = (name) => (event) => setDraft((f) => ({ ...f, [name]: event.target.value }));
  const type = types.find((item) => item.title === draft.type) || types[0];
  return (
    <form
      className="panel ds-form"
      aria-label="Date search filters"
      onSubmit={(event) => {
        event.preventDefault();
        onSearch();
      }}
    >
      <div className="field">
        <label htmlFor="date-start">From</label>
        <input type="date" id="date-start" value={draft.start} onChange={change('start')} />
      </div>
      <div className="field">
        <label htmlFor="date-end">To</label>
        <input
          type="date"
          id="date-end"
          value={draft.end}
          aria-invalid={invalidRange || undefined}
          aria-describedby={invalidRange ? RANGE_ERROR_ID : undefined}
          onChange={change('end')}
        />
      </div>
      <div className="field">
        <label htmlFor="date-record-type">Records</label>
        <select id="date-record-type" value={type?.title || ''} onChange={change('type')}>
          {types.map((item) => (
            <option key={item.title}>{item.title}</option>
          ))}
        </select>
      </div>
      {invalidRange && (
        <p id={RANGE_ERROR_ID} className="field-error ds-range-error" role="alert">
          The end date must be on or after the start date.
        </p>
      )}
      <div className="ds-actions">
        <Button variant="light" onClick={onClear}>
          Clear
        </Button>
        <Button type="submit" icon="search">
          Search
        </Button>
      </div>
    </form>
  );
}
