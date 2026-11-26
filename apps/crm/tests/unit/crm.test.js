import assert from 'node:assert/strict';
import test from 'node:test';
import {
  computedVal,
  deriveLeadScore,
  feeNumber,
  isDue,
  leadTier,
  yourFee,
} from '../../src/lib/crm.js';
import { dateShift, today } from '../../src/lib/dates.js';
import { blank, newId, schema } from '../../src/lib/schema.js';
import { listingIntent, priceBasis, propertyMatchesPurpose } from '../../src/lib/properties.js';

test('commission uses the partner split before the agent split', () => {
  const deal = {
    agreed_value_aed: 2000000,
    fee_basis: 'Percentage',
    fee_rate: 2,
    partner_share: 25,
    your_share: 50,
  };
  assert.equal(feeNumber(deal), 40000);
  assert.equal(yourFee(deal), 15000);
  assert.equal(yourFee({ ...deal, fee_basis: 'Fixed', fixed_fee_aed: 10000 }), 3750);
});

test('only receipts linked to an earned deal reduce its outstanding balance', () => {
  const data = blank();
  const deal = {
    deal_id: 'DL-001',
    fee_basis: 'Fixed',
    fixed_fee_aed: 10000,
    your_share: 50,
    earned_date: today(),
  };
  data.Payments = [
    { deal_id: 'DL-001', your_fee_received_aed_ex_vat: 1500 },
    { deal_id: 'DL-OTHER', your_fee_received_aed_ex_vat: 99999 },
  ];
  assert.equal(computedVal(data, 'Deals', deal, 'outstanding_aed'), 3500);
  assert.equal(computedVal(data, 'Deals', deal, 'payment_status'), 'Outstanding');
  data.Payments.push({ deal_id: 'DL-001', your_fee_received_aed_ex_vat: 4000 });
  assert.equal(computedVal(data, 'Deals', deal, 'outstanding_aed'), 0);
  assert.equal(computedVal(data, 'Deals', deal, 'payment_status'), 'Paid');
  assert.equal(
    computedVal(data, 'Deals', { ...deal, earned_date: '' }, 'payment_status'),
    'Not earned',
  );
});

test('lead qualification and manual scores retain the existing tiers', () => {
  const qualified = {
    funds_confirmed: 'Yes',
    decision_maker: 'Yes',
    buying_moving_urgency: 'Within 30 days',
    maximum_budget_aed: 1000000,
    preferred_communities: 'Dubai Marina',
    finance_type: 'Cash',
  };
  assert.equal(deriveLeadScore(qualified), 100);
  assert.equal(leadTier(qualified), 'Hot');
  assert.equal(leadTier({ lead_quality_score_100: 60 }), 'Warm');
  assert.equal(leadTier({}), 'Nurture');
  assert.equal(deriveLeadScore({ lead_quality_score_100: 150 }), 100);
  assert.equal(leadTier({ ...qualified, lead_stage: 'Lost' }), 'Lost');
  assert.equal(leadTier({ ...qualified, lead_stage: 'Closed' }), 'Converted');
});

test('closed tasks are excluded from reminders and the next client follow-up', () => {
  const data = blank();
  const client = { client_id: 'CL-001' };
  data['Follow-ups'] = [
    { client_id: 'CL-001', due_date: dateShift(-2), task_status: 'Completed' },
    { client_id: 'CL-001', due_date: dateShift(3), task_status: 'Open' },
    { client_id: 'CL-001', due_date: today(), task_status: 'In progress' },
    { client_id: 'CL-002', due_date: dateShift(-1), task_status: 'Open' },
  ];
  assert.equal(isDue(data['Follow-ups'][0]), false);
  assert.equal(isDue(data['Follow-ups'][2]), true);
  assert.equal(computedVal(data, 'Clients', client, 'next_follow_up_auto'), today());
  assert.equal(computedVal(data, 'Clients', client, 'follow_up_status_auto'), 'Due today');
});

test('record IDs remain unique after records have been deleted', () => {
  const records = [{ client_id: 'CL-001' }, { client_id: 'CL-003' }, { client_id: 'CL-004' }];
  const before = structuredClone(records);
  assert.equal(newId('Clients', records), 'CL-005');
  assert.deepEqual(records, before);
  assert.equal(newId('Properties', []), 'PR-001');
});

test('original property rows infer pricing without requiring new workbook fields', () => {
  assert.equal(priceBasis({ sale_rental: 'Sale' }), 'Total price');
  assert.equal(priceBasis({ sale_rental: 'Rental' }), 'Annual');
  assert.equal(priceBasis({ sale_rental: 'Holiday home' }), 'Nightly');
  assert.equal(priceBasis({ sale_rental: 'Rental', price_basis: 'Monthly' }), 'Monthly');
  assert.equal(listingIntent({ sale_rental: 'Short-term rental' }), 'Holiday home');
});

test('property purposes combine with commercial and off-plan classifications', () => {
  const office = { property_type: 'Office', sale_rental: 'Rental', ready_off_plan: 'Ready' };
  assert.equal(propertyMatchesPurpose(office, 'Commercial'), true);
  assert.equal(propertyMatchesPurpose(office, 'Rental'), true);
  assert.equal(propertyMatchesPurpose(office, 'Sale'), false);
  assert.equal(propertyMatchesPurpose(office, 'Off-plan'), false);
  assert.equal(propertyMatchesPurpose({ ...office, ready_off_plan: 'Off-plan' }, 'Off-plan'), true);
});

test('record schemas preserve editable and calculated workbook fields', () => {
  const clients = schema('Clients');
  assert.equal(clients.find((field) => field.name === 'Full name').key, 'full_name');
  assert.equal(clients.find((field) => field.name === 'Next follow-up auto').calculated, true);
  assert.equal(
    schema('Properties').find((field) => field.name === 'Property description').type,
    'textarea',
  );
  assert.equal(
    schema('Deals').find((field) => field.name === 'Your expected fee AED').calculated,
    true,
  );
});
