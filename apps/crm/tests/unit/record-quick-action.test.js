import assert from 'node:assert/strict';
import test from 'node:test';
import { emptyFact } from '../../src/features/records/panel/factSections.js';
import { quickAction } from '../../src/features/server/quickActions/quickActionModel.js';

const both = { deal: true, property: true };

test('a client offers Convert to deal and a contact Add a property, when allowed', () => {
  const client = quickAction('Clients', { client_id: 'CL-1' }, both);
  assert.deepEqual([client.kind, client.clientId], ['deal', 'CL-1']);
  const contact = quickAction('Contacts', { contact_id: 'CT-1' }, both);
  assert.deepEqual([contact.kind, contact.defaults], ['property', { contact_id: 'CT-1' }]);
  assert.equal(quickAction('Clients', { client_id: 'CL-1' }, { property: true }), null);
  assert.equal(quickAction('Contacts', { contact_id: 'CT-1' }, { deal: true }), null);
  assert.equal(quickAction('Properties', { property_id: 'PR-1' }, both), null);
  assert.equal(quickAction('Clients', { client_id: '' }, both), null);
});

test('a fact is empty when it has nothing to show', () => {
  const field = (key) => ({ key, name: key });
  const record = { phone: '+971', email: '', budget: 0, deal_id_optional: '' };
  assert.equal(emptyFact({}, 'Clients', record, field('phone')), false);
  assert.equal(emptyFact({}, 'Clients', record, field('email')), true);
  assert.equal(emptyFact({}, 'Clients', record, field('budget')), false);
  assert.equal(emptyFact({}, 'Clients', record, field('missing')), true);
  assert.equal(emptyFact({}, 'Interaction log', record, field('deal_id_optional')), true);
});
