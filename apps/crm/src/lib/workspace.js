import { isDue, leadTier, yourFee } from './crm.js';
import { dateNum, today } from './dates.js';
import { SUM, amountOf, clName, get, isDone, isLost, prName } from './records.js';
import { schema } from './schema.js';

/** Derived workspace data; retains the existing commission and reminder policies. */
export function selectWorkspaceSummary(data) {
  const openLeads = data.Clients.filter(
    (record) =>
      !isLost(get(record, 'Lead stage')) &&
      !/closed/i.test(String(get(record, 'Lead stage') || '')),
  );
  const activeDeals = data.Deals.filter((record) => !isDone(get(record, 'Deal stage')));
  const tasks = data['Follow-ups'].filter((record) => !isDone(get(record, 'Task status')));
  const dueTasks = tasks.filter(isDue);
  const earned = SUM(data.Deals, (deal) => (get(deal, 'Earned date') ? yourFee(deal) : 0));
  const receipts = SUM(data.Payments, (payment) =>
    amountOf(payment, 'Your fee received AED ex VAT'),
  );
  const expenses = SUM(data.Expenses, (expense) => amountOf(expense, 'Amount paid AED'));
  const upcoming = data.Viewings.filter(
    (viewing) => dateNum(get(viewing, 'Appointment date & time')) >= dateNum(today()),
  ).sort(
    (a, b) =>
      dateNum(get(a, 'Appointment date & time')) - dateNum(get(b, 'Appointment date & time')),
  );

  return {
    openLeads,
    activeDeals,
    tasks,
    dueTasks,
    earned,
    receipts,
    expenses,
    upcoming,
    outstanding: Math.max(0, earned - receipts),
    hot: data.Clients.filter((client) => leadTier(client) === 'Hot'),
    warm: data.Clients.filter((client) => leadTier(client) === 'Warm'),
    clientCare: data['Client care'].filter(isDue),
  };
}

export function getRecordText(data, module, record) {
  return [
    ...schema(module).map((field) => record[field.key]),
    clName(data, get(record, 'Client ID')),
    prName(data, get(record, 'Property ID')),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

/** Return a new array, retaining original record references for edit/detail actions. */
export function selectRecords(
  data,
  module,
  { query = '', sort = { key: '', direction: 'asc' }, filter } = {},
) {
  let records = [...(data[module] || [])];
  const search = query.trim().toLowerCase();
  if (search)
    records = records.filter((record) => getRecordText(data, module, record).includes(search));
  if (filter) records = records.filter(filter);
  if (sort.key) {
    records.sort((a, b) => {
      const aValue = String(a[sort.key] ?? '');
      const bValue = String(b[sort.key] ?? '');
      const result = aValue.localeCompare(bValue, undefined, {
        numeric: true,
        sensitivity: 'base',
      });
      return sort.direction === 'asc' ? result : -result;
    });
  }
  return records;
}
