import React from 'react';
import { selectCalendarEntries } from './selectors.js';

export function RecordSchedule({ module, record, data }) {
  const entry = selectCalendarEntries(data).find(
    (item) => item.module === module && item.record === record,
  );
  if (!entry) return null;
  return (
    <section className="record-schedule" aria-label="Activity schedule">
      <div className="calendar-row-heading">
        <h3>{entry.activity} schedule</h3>
      </div>
      <p>
        {entry.day} · {entry.time} · Dubai time
        {entry.record.calendar_location ? ` · ${entry.record.calendar_location}` : ''}
      </p>
      {entry.record.calendar_duration && <p>Duration: {entry.record.calendar_duration} minutes</p>}
    </section>
  );
}
