import test from 'node:test';
import assert from 'node:assert/strict';
import {
  noticeRows,
  noticeTotal,
  rowsForTab,
} from '../../src/features/server/products/noticesModel.js';

const counts = { mentions: 2, handovers: 1, agreements: 0, clients: 3, contacts: 1 };

test('the bell lists only non-zero counts on pages the person may open, in a fixed order', () => {
  const rows = noticeRows(counts, () => true);
  assert.deepEqual(
    rows.map((row) => [row.key, row.count, row.route]),
    [
      ['mentions', 2, 'Team chat'],
      ['handovers', 1, 'Deals'],
      ['clients', 3, 'Clients'],
      ['contacts', 1, 'Contacts'],
    ],
  );
  const noDeals = noticeRows(counts, (route) => route !== 'Deals');
  assert.deepEqual(
    noDeals.map((row) => row.key),
    ['mentions', 'clients', 'contacts'],
  );
  assert.equal(noticeTotal(rows), 7);
  assert.equal(noticeTotal([]), 0);
});

test('tabs show mentions or approvals; shared records only under All', () => {
  const rows = noticeRows({ ...counts, applications: 2 }, () => true);
  assert.equal(rowsForTab(rows, 'all').length, 5);
  assert.deepEqual(
    rowsForTab(rows, 'mentions').map((row) => row.key),
    ['mentions'],
  );
  assert.deepEqual(
    rowsForTab(rows, 'approvals').map((row) => row.key),
    ['handovers', 'applications'],
  );
});
