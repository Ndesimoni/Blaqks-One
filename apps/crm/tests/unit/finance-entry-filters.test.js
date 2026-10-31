import test from 'node:test';
import assert from 'node:assert/strict';
import {
  decidableCount,
  earnedDealOptions,
  emptyEntryFilters,
  filterEntries,
  initialEntryFilters,
  paymentPreview,
  QUEUE_QUERY,
  receiptHost,
} from '../../src/features/server/finance/entryFilters.js';

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

test('the queue shows pending rows; status and search narrow further', () => {
  const rows = [
    row('PM-001', 'pending', { allowed: allowed(true) }),
    row('PM-002', 'approved', { reference: 'INV-77' }),
    row('PM-003', 'pending'),
    row('PM-004', 'rejected'),
  ];
  const ids = (filters) =>
    filterEntries(rows, { ...emptyEntryFilters, ...filters }).map((r) => r.id);
  assert.deepEqual(ids({ queue: true }), ['PM-001', 'PM-003']);
  assert.deepEqual(ids({ status: 'rejected' }), ['PM-004']);
  assert.deepEqual(ids({ query: 'inv-77' }), ['PM-002']);
  assert.deepEqual(ids({ queue: true, status: 'approved' }), []);
  assert.equal(decidableCount(rows.filter((r) => r.status === 'pending')), 1);
  assert.deepEqual(initialEntryFilters(QUEUE_QUERY), { ...emptyEntryFilters, queue: true });
  assert.deepEqual(initialEntryFilters('PM-2'), { ...emptyEntryFilters, query: 'PM-2' });
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
