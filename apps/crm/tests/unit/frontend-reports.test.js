import assert from 'node:assert/strict';
import test from 'node:test';
import {
  rollingMonths,
  selectDateRecords,
  selectMonthlyPerformance,
  selectPerformanceMonth,
} from '../../src/features/reports/selectors.js';
import { blank } from '../../src/lib/schema.js';

test('rolling reports include February from a month-end date and report the selected historical month', () => {
  const now = new Date(2026, 2, 31);
  assert.deepEqual(rollingMonths(3, now), ['2026-01', '2026-02', '2026-03']);
  const data = blank();
  data.Clients = [{ client_id: 'CL-1', date_added: '2020-02-01' }];
  assert.equal(selectMonthlyPerformance(data, now).length, 12);
  assert.equal(selectPerformanceMonth(data, '2020-02').newLeads, 1);
  assert.equal(selectPerformanceMonth(data, '2026-02').newLeads, 0);
});
test('date search uses inclusive boundaries, chronological order and explicit invalid ranges', () => {
  const data = blank();
  data.Clients = [
    { client_id: 'CL-2', date_added: '2026-10-08' },
    { client_id: 'CL-1', date_added: '2026-10-01' },
    { client_id: 'CL-3', date_added: '2026-09-30' },
  ];
  const filter = { type: 'New enquiries', start: '2026-10-01', end: '2026-10-08' };
  assert.deepEqual(
    selectDateRecords(data, filter).records.map((row) => row.client_id),
    ['CL-1', 'CL-2'],
  );
  assert.equal(selectDateRecords(data, { ...filter, start: '2026-10-09' }).invalidRange, true);
  assert.equal(data.Clients[0].client_id, 'CL-2');
});
