import { dateSearchTypes, selectDateRecords } from './selectors.js';
import { clName, get, prName } from '../../lib/records.js';
import { TitleSection } from '../../components/ui/TitleSection.jsx';
import { readableDate } from '../../lib/dates.js';
import { Icon } from '../../components/ui/Icon.jsx';
import { schema } from '../../lib/schema.js';
import { Empty } from '../../components/ui/Empty.jsx';
import React from 'react';
import { OverflowList } from '../../components/ui/OverflowList.jsx';
import { useRecords, useWorkspaceView, useWorkspaceActions } from '../../hooks/useWorkspace.js';

function DateSearchPage() {
  const { data } = useRecords();
  const { dateFilter, setDateFilter } = useWorkspaceView();
  const { dispatchRow } = useWorkspaceActions();

  const types = dateSearchTypes;
  const { type, records: arr, invalidRange } = selectDateRecords(data, dateFilter);

  return (
    <div className="page-stack">
      <div className="panel date-controls">
        <div className="field">
          <label htmlFor="date-record-type">RECORD TYPE</label>
          <select
            id="date-record-type"
            value={dateFilter.type}
            onChange={(e) => setDateFilter((f) => ({ ...f, type: e.target.value }))}
          >
            {types.map((t) => (
              <option key={t.title}>{t.title}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="date-start">FROM DATE</label>
          <input
            type="date"
            id="date-start"
            value={dateFilter.start}
            onChange={(e) => setDateFilter((f) => ({ ...f, start: e.target.value }))}
          />
        </div>
        <div className="field">
          <label htmlFor="date-end">TO DATE</label>
          <input
            type="date"
            id="date-end"
            value={dateFilter.end}
            onChange={(e) => setDateFilter((f) => ({ ...f, end: e.target.value }))}
          />
        </div>
        <div className="date-result">
          <strong>{arr.length}</strong>
          <span>matching records</span>
        </div>
      </div>
      {invalidRange && (
        <p className="field-error" role="alert">
          The end date must be on or after the start date.
        </p>
      )}
      <div className="panel">
        <TitleSection
          heading="Matching records"
          caption={`${dateFilter.type} · ${readableDate(dateFilter.start)} to ${readableDate(dateFilter.end)}`}
        />
        <OverflowList
          mode="scroll"
          className="record-results-list"
          key={JSON.stringify(dateFilter)}
          items={arr}
          getKey={(r) => get(r, schema(type.module)[0].name)}
          label="Date search matches"
          listClassName="date-result-list"
          renderItem={(r, _index, { close }) => (
            <button
              type="button"
              className="result-row"
              onClick={() => {
                close();
                dispatchRow(type.module, r);
              }}
            >
              <span className="result-icon">
                <Icon name="calendar" size={18} />
              </span>
              <div>
                <strong>{get(r, schema(type.module)[0].name)}</strong>
                <small>
                  {clName(data, get(r, 'Client ID')) !== '—'
                    ? clName(data, get(r, 'Client ID'))
                    : prName(data, get(r, 'Property ID'))}
                </small>
              </div>
              <div className="result-date">{readableDate(get(r, type.field))}</div>
              <Icon name="arrow" size={17} />
            </button>
          )}
          after={
            !arr.length && (
              <Empty
                title="No records in this range"
                detail="Change the record type or expand the dates to explore more results."
                icon="calendar"
              />
            )
          }
        />
      </div>
    </div>
  );
}

export { DateSearchPage };
