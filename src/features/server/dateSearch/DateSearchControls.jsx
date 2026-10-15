import React from 'react';

export function DateSearchControls({ types, type, filter, setFilter, count }) {
  const change = (name) => (event) => setFilter((f) => ({ ...f, [name]: event.target.value }));
  return (
    <div className="panel date-controls">
      <div className="field">
        <label htmlFor="date-record-type">RECORD TYPE</label>
        <select id="date-record-type" value={type?.title || ''} onChange={change('type')}>
          {types.map((t) => (
            <option key={t.title}>{t.title}</option>
          ))}
        </select>
      </div>
      <div className="field">
        <label htmlFor="date-start">FROM DATE</label>
        <input type="date" id="date-start" value={filter.start} onChange={change('start')} />
      </div>
      <div className="field">
        <label htmlFor="date-end">TO DATE</label>
        <input type="date" id="date-end" value={filter.end} onChange={change('end')} />
      </div>
      <div className="date-result">
        <strong>{count}</strong>
        <span>matching records</span>
      </div>
    </div>
  );
}
