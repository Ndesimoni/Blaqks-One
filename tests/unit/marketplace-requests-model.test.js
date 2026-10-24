import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  readBoard,
  readMyRequests,
  readOneRequest,
  readRequirements,
} from '../../src/features/server/marketplace/requestsModel.js';

/** Strict readers for client requests, the board and My requests (packet MK2). */
const facts = {
  id: '6f0e6b0e-2d4a-4c2c-9a4a-2f0b7e8a1c11',
  purpose: 'rent',
  emirate: 'dubai',
  communities: ['Dubai Marina', 'JVC'],
  openToOtherAreas: true,
  propertyType: 'Apartment',
  bedrooms: 2,
  budgetBand: 'rent_150k',
  ready: 'ready',
  furnishing: 'furnished',
  cheques: 6,
  buildingAge: 'under_5',
  moveIn: '2026-11',
  createdAt: '2026-10-24T10:00:00.000Z',
  expiresAt: '2026-11-23T10:00:00.000Z',
};
const broker = {
  memberId: 'b7a1e0f3-1c2d-4e5f-8a9b-0c1d2e3f4a5b',
  name: 'Synthetic Broker',
  company: 'Synthetic Company',
  hasPhoto: false,
};

test('a board page reads its cards and its cursor', () => {
  const page = readBoard({ requests: [{ ...facts, broker }], nextCursor: '2026-10-24|abc' });
  assert.equal(page.requests.length, 1);
  assert.equal(page.requests[0].budgetBand, 'rent_150k');
  assert.equal(page.requests[0].broker.name, 'Synthetic Broker');
  assert.equal(page.nextCursor, '2026-10-24|abc');
  assert.equal(readBoard({ requests: [], nextCursor: null }).nextCursor, '');
  assert.equal(page.requests[0].yourCompany, false);
  const own = readBoard({ requests: [{ ...facts, broker, yourCompany: true }], nextCursor: null });
  assert.equal(own.requests[0].yourCompany, true);
});

test('a card may not carry the client or the exact budget', () => {
  const page = readBoard({ requests: [{ ...facts, broker }], nextCursor: null });
  const text = JSON.stringify(page);
  for (const secret of ['clientId', 'budgetMaxAed', 'Synthetic Request Client']) {
    assert.equal(text.includes(secret), false, secret);
  }
});

test('unknown choices, money and dates are refused rather than half-shown', () => {
  const refuse = (overrides) =>
    assert.throws(() =>
      readBoard({ requests: [{ ...facts, broker, ...overrides }], nextCursor: null }),
    );
  refuse({ purpose: 'swap' });
  refuse({ emirate: 'riyadh' });
  refuse({ budgetBand: 'buy_99m' });
  refuse({ ready: 'later' });
  refuse({ furnishing: 'bare' });
  refuse({ buildingAge: 'ancient' });
  refuse({ cheques: 5 });
  refuse({ bedrooms: -1 });
  refuse({ createdAt: 'not a date' });
  refuse({ communities: 'Dubai Marina' });
  assert.throws(() => readBoard({ requests: [{ ...facts }], nextCursor: null }));
});

test('My requests keeps the poster their client, state and own budget', () => {
  const rows = readMyRequests({
    requests: [
      {
        ...facts,
        clientId: '9d1f0e2a-1111-4222-8333-444455556666',
        clientName: 'Synthetic Request Client',
        state: 'open',
        canRenew: false,
        version: 3,
        budgetMinAed: 90_000,
        budgetMaxAed: 120_000,
      },
    ],
  });
  assert.equal(rows[0].clientName, 'Synthetic Request Client');
  assert.equal(rows[0].state, 'open');
  assert.equal(rows[0].version, 3);
  assert.equal(rows[0].budgetMaxAed, 120_000);
  assert.throws(() =>
    readMyRequests({ requests: [{ ...facts, clientId: '', state: 'gone', version: 1 }] }),
  );
});

test('the draft carries the allowlisted requirements only', () => {
  const draft = readRequirements({
    requirements: {
      purpose: 'buy',
      emirate: 'sharjah',
      communities: ['Al Majaz'],
      propertyType: 'Villa',
      bedrooms: null,
      budgetMinAed: null,
      budgetMaxAed: 2_500_000,
      moveIn: '2027-01',
    },
  });
  assert.equal(draft.purpose, 'buy');
  assert.equal(draft.emirate, 'sharjah');
  assert.deepEqual(draft.communities, ['Al Majaz']);
  assert.equal(draft.bedrooms, null);
  assert.equal(draft.budgetMaxAed, 2_500_000);
  assert.equal(draft.moveIn, '2027-01');
  assert.throws(() => readRequirements({ requirements: { purpose: 'swap' } }));
});

test('one request after a command reads like a My requests row', () => {
  const row = readOneRequest({
    request: {
      ...facts,
      clientId: '9d1f0e2a-1111-4222-8333-444455556666',
      clientName: null,
      state: 'closed',
      canRenew: false,
      version: 2,
      budgetMinAed: null,
      budgetMaxAed: 120_000,
    },
  });
  assert.equal(row.state, 'closed');
  assert.equal(row.clientName, '');
  assert.equal(row.version, 2);
  assert.throws(() => readOneRequest({}));
});
