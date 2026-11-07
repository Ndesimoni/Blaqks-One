import test from 'node:test';
import assert from 'node:assert/strict';
import { financeRoutes } from '../../src/services/crm/finance.js';
import { readFinanceAccess } from '../../src/features/server/finance/financeAccess.js';
import {
  financeRefusal,
  handoverDecidedMessage,
  holderOnlyMessage,
  pendingHandoverMessage,
} from '../../src/features/server/finance/financeRules.js';
import { financeDeniedMessages } from '../../src/features/server/finance/financeAccess.js';
import { readFinanceOverview } from '../../src/features/server/finance/financeModel.js';

function harness() {
  const calls = [];
  const request = async (path, options = {}) => {
    calls.push([options.method ?? 'GET', path.replace('/workspaces/ws/finance', ''), options.body]);
    return {};
  };
  return { calls, api: financeRoutes({ request, scope: (ws) => `/workspaces/${ws}` }) };
}
const meta = { id: 'd/1', version: 3 };

test('hand-over, earn-preview, revise and Admin move routes follow the B3 contract (§15)', async () => {
  const { calls, api } = harness();
  await api.earnPreview('ws', meta, '2026-10-01');
  await api.reviseDeal('ws', meta, 'Fix split');
  await api.reviseDeal('ws', meta, 'Fix split', { overrideAgentShareBp: null, x: 1 });
  await api.reviseDeal('ws', meta, 'Add agent', { secondAgentId: 'u-2', secondAgentShareBp: 2500 });
  await api.assignDeal('ws', meta, 'u-3', 'Covering leave');
  await api.requestHandover('ws', meta, 'u-4', null);
  await api.requestHandover('ws', meta, 'u-4', 1000);
  await api.decideHandover('ws', 'h/1', 'accept');
  await api.decideHandover('ws', 'h/1', 'accept', 2);
  await api.decideHandover('ws', 'h/1', 'decline');
  await api.decideHandover('ws', 'h/1', 'cancel');
  await api.approveHandover('ws', 'h/1', 500, 'Adjusted', 2);
  await api.approveHandover('ws', 'h/1', undefined, 'Full');
  assert.deepEqual(calls, [
    ['GET', '/deals/d%2F1/earn-preview?earnedOn=2026-10-01', undefined],
    ['POST', '/deals/d%2F1/revise', { version: 3, reason: 'Fix split' }],
    [
      'POST',
      '/deals/d%2F1/revise',
      { version: 3, reason: 'Fix split', overrideAgentShareBp: null },
    ],
    [
      'POST',
      '/deals/d%2F1/revise',
      { version: 3, reason: 'Add agent', secondAgentId: 'u-2', secondAgentShareBp: 2500 },
    ],
    ['PUT', '/deals/d%2F1/assignee', { version: 3, assigneeId: 'u-3', reason: 'Covering leave' }],
    ['POST', '/deals/d%2F1/handovers', { version: 3, toId: 'u-4', referralShareBp: null }],
    ['POST', '/deals/d%2F1/handovers', { version: 3, toId: 'u-4', referralShareBp: 1000 }],
    ['POST', '/handovers/h%2F1/accept', undefined],
    ['POST', '/handovers/h%2F1/accept', { agreementVersion: 2 }],
    ['POST', '/handovers/h%2F1/decline', undefined],
    ['POST', '/handovers/h%2F1/cancel', undefined],
    [
      'POST',
      '/handovers/h%2F1/approve',
      { referralShareBp: 500, reason: 'Adjusted', agreementVersion: 2 },
    ],
    [
      'POST',
      '/handovers/h%2F1/approve',
      { referralShareBp: null, reason: 'Full', agreementVersion: null },
    ],
  ]);
  assert.throws(() => api.decideHandover('ws', 'h', 'approve'), /Unknown hand-over decision/);
  assert.equal(typeof api.financeHistory, 'function', 'history stays for B4');
});

const profile = (roleId, flags, scope = 'own') => ({
  roleId,
  financeAccess: { scope, ...flags },
});
const agent = readFinanceAccess(profile('staff', { create: true, edit: true, assign: true }));
const admin = readFinanceAccess(
  profile(
    'admin',
    { create: true, edit: true, assign: true, teamView: true, manage: true },
    'team',
  ),
);
const deal = (allowed, extra = {}) => ({ id: 'd', version: 1, allowed, ...extra });

test('hand-over gating follows financeAccess and the row allowed flags', () => {
  assert.equal(financeRefusal(agent, 'handOverDeal', deal({ handOver: true })), '');
  assert.equal(financeRefusal(agent, 'handOverDeal', deal({})), holderOnlyMessage);
  assert.equal(
    financeRefusal(agent, 'handOverDeal', deal({}, { pendingHandover: 'h-1' })),
    pendingHandoverMessage,
  );
  assert.equal(
    financeRefusal(agent, 'assignDeal', deal({ assign: true })),
    financeDeniedMessages.manage,
  );
  assert.equal(financeRefusal(admin, 'assignDeal', deal({ assign: true })), '');
  const request = (allowed) => ({ id: 'h-1', allowed });
  assert.equal(financeRefusal(agent, 'acceptHandover', request({ accept: true })), '');
  assert.equal(financeRefusal(agent, 'declineHandover', request({})), handoverDecidedMessage);
  assert.equal(
    financeRefusal(agent, 'approveHandover', request({ approve: true })),
    financeDeniedMessages.manage,
  );
  assert.equal(financeRefusal(admin, 'approveHandover', request({ approve: true })), '');
  assert.equal(
    financeRefusal(agent, 'acceptHandover', request({ accept: true }), true),
    'Archived workspaces are read-only.',
  );
  assert.equal(
    financeRefusal(readFinanceAccess(null), 'acceptHandover', request({ accept: true })),
    financeDeniedMessages.module,
  );
});

test('the overview reads hand-overs and primary statement lines with their share', () => {
  const line = { dealId: 'DL-0001', earnedOn: '2026-10-01', dealType: 'Sale', role: 'primary' };
  const model = readFinanceOverview({
    scope: 'own',
    settings: null,
    myAgreements: [],
    deals: [],
    payments: [],
    expenses: [],
    handovers: [
      {
        ...{ id: 'h-1', dealId: 'DL-0001', dealType: 'Sale', stage: 'Offer', earned: false },
        ...{ from: { id: 'u-1', name: 'Sara' }, to: { id: 'u-2', name: 'Omar' } },
        ...{ referralShareBp: null, status: 'pending', createdAt: 'now', allowed: {} },
      },
    ],
    statement: {
      lines: [{ ...line, shareBp: 5000, adjusted: true, amountFils: 10, receivedShareFils: 0 }].map(
        (row) => ({ ...row, outstandingFils: 10 }),
      ),
      totals: { earnedFils: 10, receivedShareFils: 0, outstandingFils: 10 },
    },
    references: {},
  });
  assert.equal(model.handovers[0].to.name, 'Omar');
  assert.equal(model.statement.lines[0].shareBp, 5000, 'primary lines keep their share');
  assert.equal(model.statement.lines[0].adjusted, true);
});
