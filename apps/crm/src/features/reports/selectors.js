import { monthOf, pad } from '../../lib/dates.js';
import { SUM, get } from '../../lib/records.js';
import { yourFee } from '../../lib/crm.js';

export const dateSearchTypes = [
  { title: 'New enquiries', module: 'Clients', field: 'Date added' },
  { title: 'Follow-ups', module: 'Follow-ups', field: 'Due date' },
  { title: 'Viewings', module: 'Viewings', field: 'Appointment date & time' },
  { title: 'Deals opened', module: 'Deals', field: 'Opened date' },
  { title: 'Deals closed', module: 'Deals', field: 'Closed date' },
  { title: 'Fee receipts', module: 'Payments', field: 'Receipt date' },
  { title: 'Expenses paid', module: 'Expenses', field: 'Date paid' },
  { title: 'Care appointments', module: 'Client care', field: 'Next contact' },
];

export function selectDateRecords(data, filter) {
  const type = dateSearchTypes.find((type) => type.title === filter.type) || dateSearchTypes[0];
  const invalidRange = Boolean(filter.start && filter.end && filter.start > filter.end);
  const records = invalidRange
    ? []
    : data[type.module]
        .filter((row) => {
          const value = String(get(row, type.field) || '').slice(0, 10);
          return (
            value &&
            (!filter.start || value >= filter.start) &&
            (!filter.end || value <= filter.end)
          );
        })
        .sort((a, b) => String(get(a, type.field)).localeCompare(String(get(b, type.field))));
  return { type, records, invalidRange };
}

export function rollingMonths(count, now = new Date()) {
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - count + 1 + index, 1);
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
  });
}

export function selectMonthlyPerformance(data, now = new Date()) {
  return rollingMonths(12, now).map((month) => ({
    month,
    newLeads: data.Clients.filter((row) => monthOf(get(row, 'Date added')) === month).length,
    viewings: data.Viewings.filter(
      (row) =>
        monthOf(get(row, 'Appointment date & time')) === month &&
        get(row, 'Viewing status') === 'Completed',
    ).length,
    deals: data.Deals.filter(
      (row) =>
        monthOf(get(row, 'Closed date')) === month &&
        /completed/i.test(String(get(row, 'Deal stage'))),
    ).length,
    fees: SUM(
      data.Deals.filter((row) => monthOf(get(row, 'Earned date')) === month),
      yourFee,
    ),
  }));
}

export function selectPerformanceMonth(data, month) {
  const date = new Date(`${month}-01T12:00:00`);
  return Number.isFinite(date.getTime()) ? selectMonthlyPerformance(data, date).at(-1) : null;
}
