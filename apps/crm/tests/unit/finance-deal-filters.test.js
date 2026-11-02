import test from 'node:test';
import assert from 'node:assert/strict';
import { clientOptions, propertyOptions } from '../../src/features/server/finance/dealOptions.js';
import {
  clampPage,
  closingThisMonth,
  dealPresets,
  dealTitle,
  emptyDealFilters,
  filterDeals,
  filtersActive,
  holderName,
  QUEUE,
} from '../../src/features/server/finance/dealFilters.js';

const entry = (id, name, assignee) => ({ record: { client_id: id, full_name: name }, assignee });

test('staff may pick only clients they hold; Admins any visible client', () => {
  const entries = {
    Clients: [entry('CL-2', 'Zed', 'u-1'), entry('CL-1', 'Amal', 'u-2'), entry('CL-3', '', null)],
    Properties: [{ record: { property_id: 'PR-1', listing_title: 'Marina flat' } }],
  };
  const staff = clientOptions(entries, { id: 'u-1' }, { manage: false });
  assert.deepEqual(staff, [{ id: 'CL-2', label: 'Zed (CL-2)' }]);
  const admin = clientOptions(entries, { id: 'u-9' }, { manage: true });
  assert.deepEqual(
    admin.map((option) => option.id),
    ['CL-1', 'CL-3', 'CL-2'],
  );
  const editing = clientOptions(entries, { id: 'u-1' }, { manage: false }, 'CL-7');
  assert.equal(
    editing.find((option) => option.id === 'CL-7').label,
    'CL-7 (not in your client list)',
  );
  assert.deepEqual(propertyOptions(entries), [{ id: 'PR-1', label: 'Marina flat (PR-1)' }]);
});

test('filters narrow the shaped deals and pages clamp to what is left', () => {
  const deals = [
    { dealId: 'DL-1', clientId: 'CL-1', stage: 'Offer', earnedOn: null, assignee: null },
    {
      dealId: 'DL-2',
      clientId: 'CL-2',
      stage: 'Offer',
      earnedOn: '2026-10-01',
      assignee: { id: 'u-1', name: 'Sara' },
    },
    {
      dealId: 'DL-3',
      clientId: 'CL-3',
      stage: 'Lost',
      earnedOn: null,
      assignee: { id: 'u-2', name: 'Omar' },
    },
  ];
  const references = { Clients: [{ id: 'CL-3', name: 'Amal Haddad' }], Properties: [] };
  const ids = (filters) =>
    filterDeals(
      deals,
      { query: '', stage: '', earned: '', holder: '', ...filters },
      references,
    ).map((deal) => deal.dealId);
  assert.deepEqual(ids({ stage: 'Offer' }), ['DL-1', 'DL-2']);
  assert.deepEqual(ids({ earned: 'earned' }), ['DL-2']);
  assert.deepEqual(ids({ earned: 'unearned', holder: QUEUE }), ['DL-1']);
  assert.deepEqual(ids({ holder: 'u-2' }), ['DL-3']);
  assert.deepEqual(ids({ query: 'haddad' }), ['DL-3']);
  assert.deepEqual(ids({ query: 'sara' }), ['DL-2']);
  assert.equal(clampPage(5, 13), 1);
  assert.equal(clampPage(3, 0), 0);
  assert.equal(holderName(null, 'u-1'), 'Team queue');
  assert.equal(holderName({ id: 'u-1', name: 'Sara' }, 'u-1'), 'Sara (you)');
});

test('Closing this month keeps open deals whose target close date is this Dubai month', () => {
  const deal = (dealId, stage, target) => ({
    dealId,
    clientId: 'CL-1',
    stage,
    earnedOn: null,
    assignee: null,
    details: target ? { target_close_date: target } : {},
  });
  const deals = [
    deal('DL-1', 'Negotiation', '2026-11-20'),
    deal('DL-2', 'Completed', '2026-11-05'),
    deal('DL-3', 'Offer', '2026-12-02'),
    deal('DL-4', 'Viewing', ''),
    deal('DL-5', 'Documentation', 'next week'),
  ];
  const closing = { ...emptyDealFilters, preset: dealPresets[1] };
  const ids = (filters) =>
    filterDeals(deals, filters, {}, '2026-11-02').map((entry) => entry.dealId);
  assert.deepEqual(ids(closing), ['DL-1']);
  assert.deepEqual(ids(emptyDealFilters), ['DL-1', 'DL-2', 'DL-3', 'DL-4', 'DL-5']);
  assert.equal(closingThisMonth(deals[2], '2026-12-31'), true);
  assert.equal(filtersActive(closing), false);
  assert.equal(filtersActive({ ...closing, earned: 'earned' }), true);
});

test('a deal is named by its listing and type, else by its type', () => {
  const references = { Properties: [{ id: 'PR-1', name: 'Marina Gate 2-bed' }] };
  const deal = { dealType: 'Rental', propertyId: 'PR-1' };
  assert.equal(dealTitle(deal, references), 'Marina Gate 2-bed · Rental');
  assert.equal(dealTitle({ ...deal, propertyId: 'PR-9' }, references), 'Rental deal');
  assert.equal(dealTitle({ dealType: 'Sale', propertyId: null }, {}), 'Sale deal');
});
