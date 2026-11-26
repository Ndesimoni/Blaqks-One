import React from 'react';

export function calendarStatus(entry, status) {
  if (!entry.enabled) return 'Not linked';
  if (Object.keys(entry.errors).length) return 'Needs details';
  const item = status.items?.[entry.key];
  if (status.uploadPending) return entry.closed ? 'Cancelling' : 'Pending';
  if (item?.state === 'failed') return 'Failed';
  if (entry.closed) return item?.state === 'pending' ? 'Cancelling' : 'Completed / cancelled';
  if (!status.connected || !status.calendar) return 'Pending connection';
  return item?.state === 'synced' ? 'Synced' : 'Pending';
}

export function CalendarStatus({ entry, status }) {
  const label = calendarStatus(entry, status);
  return (
    <span
      className={`calendar-status${label === 'Synced' ? ' is-synced' : label === 'Failed' || label === 'Needs details' ? ' is-failed' : ''}`}
    >
      {label}
    </span>
  );
}
