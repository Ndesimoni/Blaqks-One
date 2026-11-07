import assert from 'node:assert/strict';
import test from 'node:test';
import { blank } from '../../src/lib/schema.js';
import { dateShift, today } from '../../src/lib/dates.js';
import { getRecordText, selectRecords, selectWorkspaceSummary } from '../../src/lib/workspace.js';

test('workspace summaries preserve lead, commission, receipt, expense, and reminder rules', () => {
  const data = blank();
  data.Clients = [
    { client_id: 'CL-HOT', lead_stage: 'Qualified', lead_quality_score_100: 90 },
    { client_id: 'CL-WARM', lead_stage: 'New', lead_quality_score_100: 60 },
    { client_id: 'CL-CLOSED', lead_stage: 'Closed', lead_quality_score_100: 100 },
    { client_id: 'CL-LOST', lead_stage: 'Lost', lead_quality_score_100: 100 },
  ];
  data.Deals = [
    {
      deal_id: 'DL-EARNED',
      deal_stage: 'Completed',
      earned_date: today(),
      fee_basis: 'Fixed',
      fixed_fee_aed: 10000,
      your_share: 50,
    },
    {
      deal_id: 'DL-OPEN',
      deal_stage: 'Negotiation',
      fee_basis: 'Fixed',
      fixed_fee_aed: 20000,
      your_share: 30,
    },
  ];
  data.Payments = [
    { deal_id: 'DL-EARNED', your_fee_received_aed_ex_vat: 1500 },
    { deal_id: 'DL-OTHER', your_fee_received_aed_ex_vat: 500 },
  ];
  data.Expenses = [{ amount_paid_aed: 250 }, { amount_paid_aed: 50 }];
  data['Follow-ups'] = [
    { activity_id: 'FU-OVERDUE', due_date: dateShift(-1), task_status: 'Open' },
    { activity_id: 'FU-TODAY', due_date: today(), task_status: 'In progress' },
    { activity_id: 'FU-FUTURE', due_date: dateShift(1), task_status: 'Open' },
    { activity_id: 'FU-DONE', due_date: dateShift(-1), task_status: 'Completed' },
  ];
  data['Client care'] = [
    { care_id: 'CA-DUE', next_contact: today(), task_status: 'Open' },
    { care_id: 'CA-FUTURE', next_contact: dateShift(1), task_status: 'Open' },
  ];
  const before = structuredClone(data);
  const summary = selectWorkspaceSummary(data);
  assert.deepEqual(
    summary.openLeads.map((client) => client.client_id),
    ['CL-HOT', 'CL-WARM'],
  );
  assert.deepEqual(
    summary.activeDeals.map((deal) => deal.deal_id),
    ['DL-OPEN'],
  );
  assert.equal(summary.earned, 5000);
  assert.equal(summary.receipts, 2000);
  assert.equal(summary.expenses, 300);
  assert.equal(summary.outstanding, 3000);
  assert.equal(summary.tasks.length, 3);
  assert.deepEqual(
    summary.dueTasks.map((task) => task.activity_id),
    ['FU-OVERDUE', 'FU-TODAY'],
  );
  assert.deepEqual(
    summary.hot.map((client) => client.client_id),
    ['CL-HOT'],
  );
  assert.deepEqual(
    summary.warm.map((client) => client.client_id),
    ['CL-WARM'],
  );
  assert.deepEqual(
    summary.clientCare.map((care) => care.care_id),
    ['CA-DUE'],
  );
  assert.deepEqual(data, before);
});

test('upcoming viewings retain current date-only inclusion and sort without mutating source order', () => {
  const data = blank();
  data.Viewings = [
    {
      viewing_id: 'VW-LATER',
      appointment_date_time: `${dateShift(2)}T11:00`,
      viewing_status: 'Cancelled',
    },
    {
      viewing_id: 'VW-TODAY',
      appointment_date_time: `${today()}T09:00`,
      viewing_status: 'Confirmed',
    },
    { viewing_id: 'VW-PAST', appointment_date_time: `${dateShift(-1)}T09:00` },
  ];
  const before = structuredClone(data.Viewings);
  const summary = selectWorkspaceSummary(data);
  assert.deepEqual(
    summary.upcoming.map((viewing) => viewing.viewing_id),
    ['VW-TODAY', 'VW-LATER'],
  );
  assert.deepEqual(data.Viewings, before);
  assert.equal(summary.upcoming[0], data.Viewings[1]);
});

test('blank workspaces have zero totals and overpayments never produce negative outstanding totals', () => {
  const data = blank();
  const summary = selectWorkspaceSummary(data);
  assert.equal(summary.openLeads.length, 0);
  assert.equal(summary.upcoming.length, 0);
  assert.equal(summary.earned, 0);
  assert.equal(summary.receipts, 0);
  assert.equal(summary.outstanding, 0);
  data.Payments.push({ your_fee_received_aed_ex_vat: 2000 });
  assert.equal(selectWorkspaceSummary(data).outstanding, 0);
});

test('record search matches linked client names and property titles as well as direct fields', () => {
  const data = blank();
  data.Clients = [{ client_id: 'CL-001', full_name: 'Sophia Malik' }];
  data.Properties = [{ property_id: 'PR-001', listing_title: 'Azure Marina Residence' }];
  data.Deals = [
    { deal_id: 'DL-001', client_id: 'CL-001', property_id: 'PR-001', deal_stage: 'Negotiation' },
    { deal_id: 'DL-002', deal_stage: 'Completed' },
  ];
  assert.ok(getRecordText(data, 'Deals', data.Deals[0]).includes('sophia malik'));
  assert.deepEqual(selectRecords(data, 'Deals', { query: '  SOPHIA  ' }), [data.Deals[0]]);
  assert.deepEqual(selectRecords(data, 'Deals', { query: 'azure marina' }), [data.Deals[0]]);
  assert.deepEqual(selectRecords(data, 'Deals', { query: 'DL-002' }), [data.Deals[1]]);
  assert.deepEqual(selectRecords(data, 'Deals', { query: 'unknown client' }), []);
});

test('record selection combines custom filters with numeric sorting and preserves record identities', () => {
  const data = blank();
  data.Clients = [
    { client_id: 'CL-10', full_name: 'Test ten', lead_stage: 'New' },
    { client_id: 'CL-2', full_name: 'Test two', lead_stage: 'New' },
    { client_id: 'CL-1', full_name: 'Test closed', lead_stage: 'Closed' },
  ];
  const before = structuredClone(data.Clients);
  const options = {
    query: 'test',
    filter: (client) => client.lead_stage === 'New',
    sort: { key: 'client_id', direction: 'asc' },
  };
  const result = selectRecords(data, 'Clients', options);
  assert.deepEqual(
    result.map((client) => client.client_id),
    ['CL-2', 'CL-10'],
  );
  assert.equal(result[0], data.Clients[1]);
  assert.deepEqual(
    selectRecords(data, 'Clients', {
      ...options,
      sort: { ...options.sort, direction: 'desc' },
    }).map((client) => client.client_id),
    ['CL-10', 'CL-2'],
  );
  assert.deepEqual(data.Clients, before);
  assert.notEqual(selectRecords(data, 'Clients'), data.Clients);
});
