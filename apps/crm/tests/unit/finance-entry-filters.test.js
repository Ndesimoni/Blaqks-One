import test from 'node:test';
import assert from 'node:assert/strict';
import {
  decidableCount,
  earnedDealOptions,
  filterEntries,
  initialEntryFilters,
  paymentPreview,
  QUEUE_QUERY,
  receiptHost,
} from '../../src/features/server/finance/entryFilters.js';
import { entryPresets } from '../../src/features/server/finance/entryPresets.js';

const allowed = (approve = false) => ({ edit: false, approve, reject: approve, void: false });
const row = (id, status, extra = {}) => ({
  id,
  paymentId: id,
  status,
  dealId: 'DL-001',
  submittedBy: { id: 'u-1', name: 'Amal' },
  allowed: allowed(),
  ...extra,
});

test("the mockup's presets lead; the earlier status filters follow; search narrows further", () => {
  const today = '2026-11-01';
  const rows = [
    row('PM-001', 'pending', { allowed: allowed(true), receiptDate: '2026-11-01' }),
    row('PM-002', 'approved', { reference: 'INV-77', receiptDate: '2026-10-30' }),
    row('PM-003', 'pending', { receiptDate: '2026-11-20' }),
    row('PM-004', 'rejected'),
    row('EX-001', 'void', { category: 'Digital marketing', datePaid: '2026-11-03' }),
  ];
  const ids = (preset, query = '') =>
    filterEntries(rows, { preset, query }, undefined, today).map((r) => r.id);
  assert.deepEqual(entryPresets.payments.slice(0, 3), [
    'This month',
    'Waiting for approval',
    'Approved',
  ]);
  assert.deepEqual(entryPresets.expenses.slice(0, 3), [
    'This month',
    'Waiting for approval',
    'Marketing',
  ]);
  assert.deepEqual(ids('This month'), ['PM-001', 'PM-003', 'EX-001']);
  assert.deepEqual(ids('Waiting for approval'), ['PM-001', 'PM-003']);
  assert.deepEqual(ids('Rejected'), ['PM-004']);
  assert.deepEqual(ids('Voided'), ['EX-001']);
  assert.deepEqual(ids('Marketing'), ['EX-001']);
  assert.deepEqual(ids('All payments', 'inv-77'), ['PM-002']);
  assert.deepEqual(ids('Approved', 'pm-003'), []);
  assert.equal(decidableCount(rows.filter((r) => r.status === 'pending')), 1);
  // The Dashboard's queue link opens Waiting for approval; a search looks across every row.
  assert.deepEqual(initialEntryFilters('payments', QUEUE_QUERY), {
    query: '',
    preset: 'Waiting for approval',
  });
  assert.deepEqual(initialEntryFilters('payments', 'PM-2'), {
    query: 'PM-2',
    preset: 'All payments',
  });
  assert.deepEqual(initialEntryFilters('expenses', ''), { query: '', preset: 'This month' });
});

test('receipt hosts are shown for https links only', () => {
  assert.equal(receiptHost('https://files.example.test/a.pdf'), 'files.example.test');
  assert.equal(receiptHost('http://files.example.test/a.pdf'), null);
  assert.equal(receiptHost('javascript:alert(1)'), null);
  assert.equal(receiptHost('nonsense'), null);
});

test('the deal picker lists earned deals only; VAT follows the earned figures', () => {
  const calc = (vatFils) => ({ netFils: 4_900_000, vatFils });
  const deals = [
    {
      dealId: 'DL-1',
      clientId: 'CL-1',
      dealType: 'Sale',
      earnedOn: '2026-10-01',
      calculation: calc(245_000),
    },
    { dealId: 'DL-2', clientId: 'CL-2', dealType: 'Rental', earnedOn: null, calculation: calc(0) },
    {
      dealId: 'DL-3',
      clientId: 'CL-9',
      dealType: 'Rental',
      earnedOn: '2026-10-02',
      calculation: calc(0),
    },
  ];
  const references = { Clients: [{ id: 'CL-1', name: 'Amal' }] };
  const options = earnedDealOptions(deals, references);
  assert.deepEqual(
    options.map((option) => option.label),
    ['DL-1 · Amal · Sale', 'DL-3 · CL-9 · Rental'],
  );
  assert.deepEqual(paymentPreview(1_000_000, deals[0]), {
    amountFils: 1_000_000,
    vatFils: 50_000,
    totalFils: 1_050_000,
    registered: true,
  });
  assert.equal(paymentPreview(1_000_000, deals[2]).vatFils, 0);
  assert.equal(paymentPreview(1_000_001, deals[0]).vatFils, 50_000);
  assert.equal(paymentPreview(null, deals[0]), null);
});
