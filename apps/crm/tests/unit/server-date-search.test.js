import test from 'node:test';
import assert from 'node:assert/strict';
import {
  availableSearchTypes,
  selectConnectedDateRows,
} from '../../src/features/server/dateSearch/dateSearchModel.js';

const titles = (types) => types.map((type) => type.title);
const data = {
  Clients: [
    { client_id: 'CL-1', full_name: 'Amal', date_added: '2026-10-02' },
    { client_id: 'CL-2', full_name: 'Bilal', date_added: '2026-09-01' },
  ],
};
const overview = {
  references: { Clients: [{ id: 'c1', name: 'Amal' }], Properties: [] },
  deals: [{ id: 'd1', dealId: 'DL-1', clientId: 'c1', earnedOn: '2026-10-03' }],
  payments: [{ id: 'p1', paymentId: 'PM-1', dealId: 'DL-1', receiptDate: '2026-10-04' }],
  expenses: [{ id: 'e1', expenseId: 'EX-1', datePaid: '2026-08-01', supplier: 'Print Co' }],
};

test('finance search types are hidden without finance access', () => {
  const canOpen = () => true;
  assert.deepEqual(titles(availableSearchTypes({ canOpen, financeAllowed: false })), [
    'New enquiries',
    'Follow-ups',
    'Viewings',
    'Care appointments',
  ]);
  assert.equal(availableSearchTypes({ canOpen, financeAllowed: true }).length, 7);
  const limited = availableSearchTypes({ canOpen: (m) => m === 'Clients', financeAllowed: false });
  assert.deepEqual(titles(limited), ['New enquiries']);
});

test('record and finance rows are filtered by the date range', () => {
  const types = availableSearchTypes({ canOpen: () => true, financeAllowed: true });
  const range = { start: '2026-10-01', end: '2026-10-31' };
  const clients = selectConnectedDateRows(
    data,
    overview,
    { ...range, type: 'New enquiries' },
    types,
  );
  assert.deepEqual(
    clients.rows.map((row) => row.title),
    ['CL-1'],
  );
  const pay = selectConnectedDateRows(data, overview, { ...range, type: 'Fee receipts' }, types);
  assert.deepEqual(
    pay.rows.map((row) => [row.title, row.subtitle]),
    [['PM-1', 'Amal']],
  );
  const spend = selectConnectedDateRows(data, overview, { ...range, type: 'Expenses paid' }, types);
  assert.equal(spend.rows.length, 0);
});

test('a start after the end finds nothing and reports the range as invalid', () => {
  const types = availableSearchTypes({ canOpen: () => true, financeAllowed: false });
  const result = selectConnectedDateRows(
    data,
    null,
    { type: 'New enquiries', start: '2026-10-31', end: '2026-10-01' },
    types,
  );
  assert.equal(result.invalidRange, true);
  assert.deepEqual(result.rows, []);
});
