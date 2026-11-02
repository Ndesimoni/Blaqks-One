import test from 'node:test';
import assert from 'node:assert/strict';
import {
  clientNeed,
  matchReasons,
  selectTaskClients,
} from '../../src/features/server/clientDesk/clientDeskModel.js';

test('contact-only task clients exclude visible clients and search permitted fields only', () => {
  const task = [
    { client_id: 'CL-1', full_name: 'Visible', phone: null, email: null },
    { client_id: 'CL-8', full_name: 'Noor', phone: '+971500000001', email: 'noor@x.test' },
  ];
  const visible = [{ client_id: 'CL-1' }];
  assert.deepEqual(
    selectTaskClients(task, visible).map((client) => client.client_id),
    ['CL-8'],
  );
  assert.equal(selectTaskClients(task, visible, 'noor@x').length, 1);
  assert.equal(selectTaskClients(task, visible, '0001').length, 1);
  assert.equal(selectTaskClients(task, visible, 'budget').length, 0);
  assert.deepEqual(selectTaskClients(undefined, undefined), []);
});

test("the desk reads a client's need as the mockup does", () => {
  const client = {
    bedrooms: '2',
    preferred_communities: 'Dubai Marina, JBR',
    buy_rent: 'Rent',
  };
  assert.equal(clientNeed(client), '2-bed, Dubai Marina, JBR, rent');
  assert.equal(clientNeed({ bedrooms: '0', buy_rent: 'Buy' }), 'Studio, buy');
  assert.equal(clientNeed({ property_type: 'Villa', buy_rent: 'Buy' }), 'Villa, buy');
  assert.equal(clientNeed({}), '');
});

test('a match says why: purpose, budget and area', () => {
  const client = {
    buy_rent: 'Rent',
    maximum_budget_aed: '190000',
    preferred_communities: 'Marina',
  };
  const listing = (price) => ({ price_annual_rent_aed: price, community: 'Dubai Marina' });
  assert.deepEqual(matchReasons(client, listing('185000')), [
    { tone: 'green', text: 'Rent' },
    { tone: 'green', text: 'Within budget' },
    { tone: 'green', text: 'Dubai Marina' },
  ]);
  assert.deepEqual(matchReasons(client, listing('199000'))[1], {
    tone: 'amber',
    text: '5% over budget',
  });
  assert.deepEqual(matchReasons({}, listing('100')), []);
});
