import assert from 'node:assert/strict';
import test from 'node:test';
import { columnHeading } from '../../src/features/records/grid/columnHeadings.js';
import { pageNumbers } from '../../src/features/records/grid/pagerModel.js';
import { activeTab, matchesRecordTab, recordTabs } from '../../src/features/records/selectors.js';
import { dubaiToday } from '../../src/lib/dubaiDate.js';

const pick = (module, records, tab) =>
  records.filter((record) => matchesRecordTab(module, record, tab)).map((record) => record.id);

test("the mockup's presets lead and the earlier ones follow, so no filter is lost", () => {
  assert.deepEqual(recordTabs('Clients'), [
    'All clients',
    'Buyers',
    'Tenants',
    'Hot leads',
    'Closed',
    'Lost',
  ]);
  assert.deepEqual(recordTabs('Shortlist'), ['Active shortlists', 'All shortlists']);
  assert.deepEqual(recordTabs('Client care').slice(0, 3), [
    'Due this month',
    'Birthdays',
    'Renewals',
  ]);
  // The view resets to 'All' on every page; a page without it opens on its first preset.
  assert.equal(activeTab(recordTabs('Client care'), 'All'), 'Due this month');
  assert.equal(activeTab(recordTabs('Follow-ups'), 'All'), 'All');
  assert.equal(activeTab(recordTabs('Clients'), 'Tenants'), 'Tenants');
});

test('Buyers and Tenants follow Buy / rent; the all presets keep every record', () => {
  const clients = [
    { id: 'C1', buy_rent: 'Buy' },
    { id: 'C2', buy_rent: 'Rent' },
    { id: 'C3', buy_rent: '' },
  ];
  assert.deepEqual(pick('Clients', clients, 'Buyers'), ['C1']);
  assert.deepEqual(pick('Clients', clients, 'Tenants'), ['C2']);
  assert.deepEqual(pick('Clients', clients, 'All clients'), ['C1', 'C2', 'C3']);
  const matches = [
    { id: 'S1', client_response: 'Interested' },
    { id: 'S2', client_response: 'Not interested' },
    { id: 'S3' },
  ];
  assert.deepEqual(pick('Shortlist', matches, 'Active shortlists'), ['S1', 'S3']);
  assert.deepEqual(pick('Shortlist', matches, 'All shortlists'), ['S1', 'S2', 'S3']);
});

test('Client care: due this month keeps overdue open touchpoints; occasions by type', () => {
  const now = dubaiToday();
  const [year, month] = now.split('-').map(Number);
  const nextMonth = new Date(Date.UTC(year, month, 2)).toISOString().slice(0, 10);
  const care = [
    { id: 'K1', next_contact: now, task_status: 'Open', touchpoint_type: 'Lease renewal' },
    { id: 'K2', next_contact: '2020-01-05', task_status: 'In progress' },
    { id: 'K3', next_contact: now, task_status: 'Completed' },
    { id: 'K4', next_contact: nextMonth, task_status: 'Open' },
    { id: 'K5', touchpoint_type: 'Birthday / milestone' },
  ];
  assert.deepEqual(pick('Client care', care, 'Due this month'), ['K1', 'K2']);
  assert.deepEqual(pick('Client care', care, 'Birthdays'), ['K5']);
  assert.deepEqual(pick('Client care', care, 'Renewals'), ['K1']);
  assert.equal(pick('Client care', care, 'All client care').length, care.length);
});

test("headings use the mockup's words; other columns keep their sheet names", () => {
  assert.equal(columnHeading('Clients', 'Full name'), 'Client');
  assert.equal(columnHeading('Contacts', 'Contact type'), 'Role');
  assert.equal(columnHeading('Client care', 'Next contact'), 'Due');
  assert.equal(columnHeading('Clients', 'Maximum budget AED'), 'Maximum budget');
  assert.equal(columnHeading('Deals', 'Full name'), 'Full name');
});

test('the pager numbers every page up to seven, then the ends and the current neighbours', () => {
  assert.deepEqual(pageNumbers(1, 0), [0]);
  assert.deepEqual(pageNumbers(7, 6), [0, 1, 2, 3, 4, 5, 6]);
  assert.deepEqual(pageNumbers(10, 0), [0, 1, 2, 3, 'gap-end', 9]);
  assert.deepEqual(pageNumbers(10, 5), [0, 'gap-start', 4, 5, 6, 'gap-end', 9]);
  assert.deepEqual(pageNumbers(10, 9), [0, 'gap-start', 6, 7, 8, 9]);
});
