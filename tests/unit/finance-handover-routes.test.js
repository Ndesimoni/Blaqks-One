import test from 'node:test';
import assert from 'node:assert/strict';
import { financeRoutes } from '../../src/services/crm/finance.js';
import { agreementRoutes } from '../../src/services/crm/agreements.js';
import { readFinanceAccess } from '../../src/features/server/finance/financeAccess.js';
import {
  financeRefusal,
  handoverDecidedMessage,
} from '../../src/features/server/finance/financeRules.js';
import {
  readFinanceApprovers,
  readHandover,
} from '../../src/features/server/finance/dealResponses.js';
import { readHandoverPreview } from '../../src/features/server/finance/handoverPreviewModel.js';

function harness() {
  const calls = [];
  const request = async (path, options = {}) => {
    calls.push([options.method ?? 'GET', path.replace('/workspaces/ws', ''), options.body]);
    return {};
  };
  const scope = (ws) => `/workspaces/${ws}`;
  return {
    calls,
    api: { ...financeRoutes({ request, scope }), ...agreementRoutes({ request, scope }) },
  };
}

test('H2 hand-over routes follow the agreements design §17 contract', async () => {
  const { calls, api } = harness();
  const meta = { id: 'd/1', version: 3 };
  await api.requestHandover('ws', meta, 'u-4', null);
  await api.requestHandover('ws', meta, 'u-4', null, 'u-9');
  await api.financeApprovers('ws');
  await api.handoverPreview('ws', 'h/1');
  await api.handoversWaiting('ws');
  await api.approveAcceptance('ws', 'h/1', 2);
  await api.rejectAcceptance('ws', 'h/1');
  await api.agreementsWaiting('ws');
  assert.deepEqual(calls, [
    ['POST', '/finance/deals/d%2F1/handovers', { version: 3, toId: 'u-4', referralShareBp: null }],
    [
      'POST',
      '/finance/deals/d%2F1/handovers',
      { version: 3, toId: 'u-4', referralShareBp: null, approverId: 'u-9' },
    ],
    ['GET', '/finance/approvers', undefined],
    ['GET', '/finance/handovers/h%2F1/preview', undefined],
    ['GET', '/finance/handovers/waiting', undefined],
    ['POST', '/finance/handovers/h%2F1/approve-acceptance', { agreementVersion: 2 }],
    ['POST', '/finance/handovers/h%2F1/reject-acceptance', undefined],
    ['GET', '/agreements/waiting', undefined],
  ]);
});

const person = (id, name) => ({ id, name });
const handover = (extra = {}) => ({
  ...{ id: 'h-1', dealId: 'DL-0001', dealType: 'Sale', stage: 'Offer', earned: false },
  ...{ from: person('u-1', 'Sara'), to: person('u-2', 'Omar'), referralShareBp: null },
  ...{ status: 'awaiting_approval', createdAt: 'now', toAdmin: false },
  approval: { approver: person('u-3', 'Aidah'), acceptedAt: '2026-10-22T08:00:00Z' },
  expiresAt: '2026-11-05T08:00:00Z',
  allowed: { approveAcceptance: true, rejectAcceptance: true },
  ...extra,
});

test('open hand-overs read their approval, and approver decisions follow allowed', () => {
  const view = readHandover(handover());
  assert.equal(view.status, 'awaiting_approval');
  assert.deepEqual(view.approval.approver, { id: 'u-3', name: 'Aidah' });
  const staff = readFinanceAccess({ roleId: 'staff', financeAccess: { scope: 'own' } });
  assert.equal(financeRefusal(staff, 'approveHandoverAcceptance', view), '');
  assert.equal(financeRefusal(staff, 'rejectHandoverAcceptance', view), '');
  const plain = readHandover(handover({ allowed: {} }));
  assert.equal(financeRefusal(staff, 'approveHandoverAcceptance', plain), handoverDecidedMessage);
  assert.equal(financeRefusal(staff, 'reviewHandover', plain), handoverDecidedMessage);
  assert.deepEqual(readFinanceApprovers({ approvers: [person('u-3', 'Aidah')] }), [
    person('u-3', 'Aidah'),
  ]);
});

test('the preview keeps only the listed fields', () => {
  const deal = {
    ...{ dealType: 'Sale', stage: 'Offer', earned: false, agreedValueFils: 100_000 },
    ...{ feeBasis: 'percentage', feeRateBp: 200, fixedFeeFils: null, feeFils: 2000 },
    ...{ partnerShareBp: 0, partnerName: null, partnerFils: 0, netFils: 2000 },
    ...{ receivedFils: 0, receiverEarnsFils: null, openedDate: '2026-10-01' },
    ...{ targetCloseDate: null, milestone: null, nextActionDue: null, notes: 'Private' },
  };
  const preview = readHandoverPreview({
    handover: handover(),
    offer: { agreementVersion: 2, expiresAt: null, expired: false, kind: 'full', feeFils: 2000 },
    deal,
    client: { name: 'Mariam K.', email: 'hidden@example.test' },
    property: { emirate: 'Dubai', bedrooms: 2, ownerPhone: '+971' },
  });
  assert.equal(preview.offer.agreementVersion, 2);
  assert.equal(preview.property.bedrooms, '2');
  assert.equal(preview.property.community, null);
  const text = JSON.stringify(preview);
  for (const hidden of ['Private', 'hidden@example.test', '+971'])
    assert.equal(text.includes(hidden), false);
  assert.throws(() => readHandoverPreview({ handover: handover(), offer: {}, deal, client: {} }));
});
