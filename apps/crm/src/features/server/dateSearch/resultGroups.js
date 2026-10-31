/** Presentation helpers for Date search results; rows arrive filtered and sorted by the model. */

const typeIcons = {
  'New enquiries': 'person',
  'Follow-ups': 'bell',
  Viewings: 'home',
  'Care appointments': 'heart',
  'Deals earned': 'briefcase',
  'Fee receipts': 'wallet',
  'Expenses paid': 'money',
};

export const typeIcon = (type) => typeIcons[type?.title] || 'calendar';

const asDate = (value) => new Date(`${value}T12:00:00`);

/** Consecutive rows grouped by calendar month, keeping the model's date order. */
export function groupByMonth(rows) {
  const groups = [];
  for (const row of rows) {
    const key = row.date.slice(0, 7);
    const last = groups.at(-1);
    if (last?.key === key) last.rows.push(row);
    else groups.push({ key, rows: [row] });
  }
  return groups.map((group) => ({
    ...group,
    label: asDate(`${group.key}-01`).toLocaleDateString('en-AE', {
      month: 'long',
      year: 'numeric',
    }),
  }));
}

/** Day number and short weekday for the row's date block. */
export function dayParts(value) {
  const date = asDate(value);
  if (Number.isNaN(date.getTime())) return { day: '—', weekday: '' };
  return {
    day: date.getDate(),
    weekday: date.toLocaleDateString('en-AE', { weekday: 'short' }),
  };
}

/** "3 results" style count text. */
export const countText = (count) => `${count} ${count === 1 ? 'result' : 'results'}`;
