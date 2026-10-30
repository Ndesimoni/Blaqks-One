import test from 'node:test';
import assert from 'node:assert/strict';
import { financeRoutes } from '../../src/services/crm/finance.js';
import { CrmApiError } from '../../src/services/crm/client.js';
import { runFinanceAction } from '../../src/features/server/finance/financeRules.js';
import { readFinanceAccess } from '../../src/features/server/finance/financeAccess.js';
import { overviewQuery } from '../../src/features/server/finance/useFinance.js';

function harness() {
  const calls = [];
  const request = async (path, options = {}) => {
    calls.push({ path, method: options.method ?? 'GET', body: options.body });
    return {};
  };
  const scope = (workspace) => `/workspaces/${encodeURIComponent(workspace)}`;
  return { calls, api: financeRoutes({ request, scope }) };
}
const meta = { id: 'deal/1', version: 4 };

test('settings and agreements follow the B2 contract with exact bodies', async () => {
  const { calls, api } = harness();
  await api.financeOverview('ws/1', { agent: 'u 1' });
  await api.financeOverview('ws/1');
  const settings = { agentShareBp: 5000, secondAgentSource: 'company', maxReferralShareBp: 0 };
  await api.saveFinanceSettings('ws/1', { ...settings, vatRegistered: false, trn: '', extra: 1 });
  await api.financeAgreements('ws/1', 'u-1');
  await api.createAgreement('ws/1', {
    agentId: 'u-1',
    agentShareBp: 6000,
    effectiveFrom: 'd',
    x: 1,
  });
  await api.deleteAgreement('ws/1', 'a/1');
  const base = '/workspaces/ws%2F1/finance';
  assert.deepEqual(calls, [
    { path: `${base}?agent=u%201`, method: 'GET', body: undefined },
    { path: base, method: 'GET', body: undefined },
    {
      path: `${base}/settings`,
      method: 'PUT',
      body: { version: null, ...settings, vatRegistered: false, trn: null },
    },
    { path: `${base}/agreements?agentId=u-1`, method: 'GET', body: undefined },
    {
      path: `${base}/agreements`,
      method: 'POST',
      body: { agentId: 'u-1', agentShareBp: 6000, effectiveFrom: 'd' },
    },
    { path: `${base}/agreements/a%2F1`, method: 'DELETE', body: undefined },
  ]);
});

test('deal, payment and expense routes send allowlisted integer bodies (B3/B4 contract)', async () => {
  const { calls, api } = harness();
  const draft = { clientId: 'CL-1', dealId: 'DL-9', agreedValueFils: 100, feeBasis: 'fixed' };
  await api.createDeal('ws', draft);
  await api.updateDeal('ws', meta, { ...draft, secondAgentId: 'u-2' });
  await api.earnDeal('ws', meta, '2026-10-01');
  await api.assignDeal('ws', meta, null);
  await api.splitDeal('ws', meta, { overrideAgentShareBp: 8000, reason: 'Agreed' });
  await api.createEntry('ws', 'payments', { dealId: 'DL-1', amountFils: 5, status: 'approved' });
  await api.updateEntry('ws', 'payments', meta, { dealId: 'DL-2', amountFils: 6 }, 'Typo');
  await api.decideEntry('ws', 'expenses', meta, 'approve', 'ignored');
  await api.decideEntry('ws', 'payments', meta, 'reject', 'Wrong amount');
  const deal = { clientId: 'CL-1', agreedValueFils: 100, feeBasis: 'fixed' };
  assert.deepEqual(
    calls.map(({ path, method, body }) => [
      method,
      path.replace('/workspaces/ws/finance', ''),
      body,
    ]),
    [
      ['POST', '/deals', { deal }],
      ['PATCH', '/deals/deal%2F1', { deal, version: 4 }],
      ['POST', '/deals/deal%2F1/earn', { version: 4, earnedOn: '2026-10-01' }],
      ['PUT', '/deals/deal%2F1/assignee', { version: 4, assigneeId: null, reason: '' }],
      [
        'PUT',
        '/deals/deal%2F1/split',
        {
          version: 4,
          secondAgentId: null,
          secondAgentShareBp: null,
          overrideAgentShareBp: 8000,
          reason: 'Agreed',
        },
      ],
      ['POST', '/payments', { payment: { dealId: 'DL-1', amountFils: 5 } }],
      ['PATCH', '/payments/deal%2F1', { payment: { amountFils: 6 }, version: 4, reason: 'Typo' }],
      ['POST', '/expenses/deal%2F1/approve', { version: 4 }],
      ['POST', '/payments/deal%2F1/reject', { version: 4, reason: 'Wrong amount' }],
    ],
  );
  assert.throws(() => api.createEntry('ws', 'deals', {}), /payments or expenses/);
  assert.throws(() => api.decideEntry('ws', 'payments', meta, 'delete'), /Unknown decision/);
  assert.throws(() => api.financeHistory('ws', '../records', 'x'), /payments or expenses/);
});

const admin = readFinanceAccess({
  roleId: 'admin',
  financeAccess: { scope: 'team', create: true, edit: true, approve: true, teamView: true },
});
const row = { id: 'p', version: 1, status: 'pending', allowed: { edit: true, reject: true } };

test('the action runner refuses locally, keeps drafts on 404/409 and refreshes', async () => {
  let refreshed = 0;
  let called = 0;
  const context = { access: admin, readOnly: false, refresh: async () => (refreshed += 1) };
  const call = (result) => async () => {
    called += 1;
    if (result instanceof Error) throw result;
    return result;
  };
  const denied = await runFinanceAction(context, 'saveSettings', null, call({}));
  assert.equal(denied.ok, false);
  assert.equal(called, 0, 'a local refusal never reaches the server');
  const noReason = await runFinanceAction(context, 'rejectEntry', row, call({}), { reason: ' ' });
  assert.deepEqual([noReason.ok, called, Object.keys(noReason.errors)], [false, 0, ['reason']]);
  const conflict = new CrmApiError('Stale', 409, { code: 'version_conflict' });
  const stale = await runFinanceAction(context, 'editEntry', row, call(conflict));
  assert.equal(stale.conflict, true);
  assert.match(stale.message, /Your draft is still here/);
  const gone = await runFinanceAction(context, 'editEntry', row, call(new CrmApiError('x', 404)));
  assert.deepEqual([gone.gone, gone.message], [true, 'This record is no longer available to you.']);
  const done = await runFinanceAction(context, 'createDeal', null, call({ entry: 1 }));
  assert.deepEqual(done, { ok: true, result: { entry: 1 } });
  assert.deepEqual([called, refreshed], [3, 3]);
  const abort = Object.assign(new Error('aborted'), { name: 'AbortError' });
  await assert.rejects(runFinanceAction(context, 'createDeal', null, call(abort)), /aborted/);
});

test('the agent filter is sent for team view only', () => {
  assert.deepEqual(overviewQuery(admin, 'u-1'), { agent: 'u-1' });
  assert.deepEqual(overviewQuery({ scope: 'own' }, 'u-1'), {});
  assert.deepEqual(overviewQuery(admin, null), {});
});
