import assert from 'node:assert/strict';
import test from 'node:test';
import { removeWorkspaceRecord, saveWorkspaceRecord } from '../../src/features/records/commands.js';
import { matchesRecordTab } from '../../src/features/records/selectors.js';
import { validateRecord } from '../../src/features/records/validation.js';
import { formatValue } from '../../src/lib/crm.js';
import { blank, schema } from '../../src/lib/schema.js';

test('record validation requires only an ID and reports duplicates and invalid input', () => {
  assert.deepEqual(validateRecord('Clients', { client_id: 'CL-1' }), {});
  assert.ok(validateRecord('Clients', { client_id: ' ' }).client_id);
  assert.ok(validateRecord('Clients', { client_id: 'CL-1' }, [{ client_id: 'CL-1' }]).client_id);
  const original = { client_id: 'CL-1' };
  assert.deepEqual(validateRecord('Clients', original, [original], original), {});
  const errors = validateRecord('Clients', {
    client_id: 'CL-1',
    email: 'invalid',
    maximum_budget_aed: '-1',
    lead_quality_score_100: 120,
    date_added: '2026-02-30',
  });
  assert.ok(errors.email);
  assert.ok(errors.maximum_budget_aed);
  assert.ok(errors.lead_quality_score_100);
  assert.ok(errors.date_added);
  assert.ok(
    validateRecord('Properties', { property_id: 'PR-1', virtual_tour_url: 'javascript:alert(1)' })
      .virtual_tour_url,
  );
});
test('save/delete commands preserve the original envelope, references and pricing defaults', () => {
  const original = { property_id: 'PR-1', listing_title: 'Old' };
  const second = { property_id: 'PR-2' };
  const db = {
    data: { ...blank(), Properties: [original, second] },
    demo: false,
    createdAt: 'existing',
  };
  const result = saveWorkspaceRecord(
    db,
    'Properties',
    { ...original, listing_title: 'Updated', sale_rental: 'Holiday home' },
    original,
  );
  assert.equal(result.workspace.data.Properties[0].price_basis, 'Nightly');
  assert.equal(result.workspace.data.Properties[1], second);
  assert.equal(db.data.Properties[0].listing_title, 'Old');
  assert.equal(result.workspace.createdAt, 'existing');
  const removed = removeWorkspaceRecord(result.workspace, 'Properties', original);
  assert.deepEqual(removed.data.Properties, [second]);
  assert.equal(result.workspace.data.Properties.length, 2);
});
test('failed validation and oversized saves leave the workspace unchanged', () => {
  const db = { data: blank(), demo: false };
  assert.equal(saveWorkspaceRecord(db, 'Clients', { client_id: '' }).workspace, undefined);
  assert.match(
    saveWorkspaceRecord(db, 'Properties', { property_id: 'PR-1', notes: 'x'.repeat(3000000) })
      .message,
    /storage/i,
  );
  assert.equal(db.data.Properties.length, 0);
});
test('fee/percentage metadata renders earned currency correctly and tab filters retain workflow rules', () => {
  assert.equal(
    schema('Clients').find((field) => field.key === 'lead_quality_score_100').type,
    'number',
  );
  assert.equal(schema('Deals').find((field) => field.key === 'partner_share').type, 'number');
  const field = schema('Deals').find((field) => field.key === 'your_earned_fee_aed');
  assert.equal(field.type, 'number');
  const data = blank();
  const deal = {
    deal_id: 'DL-1',
    agreed_value_aed: 1000000,
    fee_basis: 'Percentage',
    fee_rate: 2,
    your_share: 50,
    earned_date: '2026-10-01',
  };
  assert.match(formatValue(data, 'Deals', deal, field), /10,000/);
  assert.ok(validateRecord('Deals', { deal_id: 'DL-2', fee_rate: 101 }).fee_rate);
  assert.ok(
    validateRecord('Clients', {
      client_id: 'CL-1',
      minimum_budget_aed: 500,
      maximum_budget_aed: 100,
    }).maximum_budget_aed,
  );
  assert.equal(matchesRecordTab('Deals', { deal_stage: 'Completed' }, 'Completed'), true);
  assert.equal(matchesRecordTab('Deals', { deal_stage: 'Completed' }, 'Open'), false);
  assert.equal(matchesRecordTab('Follow-ups', { task_status: 'Completed' }, 'Open'), false);
});
