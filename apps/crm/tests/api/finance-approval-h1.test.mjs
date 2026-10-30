import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { request } from './helpers.mjs';
import { financePath, refused, settingsBody } from './finance-helpers.mjs';
import { UNKNOWN, createDeal, earnDeal, heldClient } from './finance-deals-helpers.mjs';
import {
  ENTRY,
  approvalTeams,
  entryPath,
  expenseBody,
  submit,
} from './finance-approval-helpers.mjs';
import { paymentBody } from './finance-approval-helpers.mjs';

let teams, payment, expense, foreign;
before(async () => {
  teams = await approvalTeams('fin-appr-h1');
  const { admin, agent, second, other } = teams;
  payment = await submit(agent, admin, 'payments', paymentBody(teams.deal.dealId));
  expense = await submit(second, admin, 'expenses', expenseBody());
  const settings = { method: 'PUT', body: settingsBody() };
  assert.equal((await other.request(financePath(other, '/settings'), settings)).status, 200);
  const elsewhere = await earnDeal(other, await createDeal(other, await heldClient(other)));
  foreign = await submit(other, other, 'payments', paymentBody(elsewhere.dealId));
});

const operations = {
  create: [ENTRY.create, 'POST', ''],
  edit: [ENTRY.edit, 'PATCH', '/ID'],
  approve: [ENTRY.approve, 'POST', '/ID/approve'],
  reject: [ENTRY.approve, 'POST', '/ID/reject'],
  void: [ENTRY.manage, 'POST', '/ID/void'],
};
const granted = {
  admin: Object.keys(operations),
  agent: ['create', 'edit'],
  viewer: ['create', 'edit'],
  approver: ['create', 'edit', 'approve', 'reject'],
  owner: [],
};
const call = (session, kind, [, method, suffix], id, body = {}) =>
  session.request(entryPath(teams.admin, kind, suffix.replace('ID', id)), { method, body });

test('H1: the finance module, then the grant or role (403), before any body (400)', async () => {
  for (const kind of ['payments', 'expenses']) {
    for (const [name, allowed] of Object.entries(granted)) {
      for (const [operation, spec] of Object.entries(operations)) {
        const result = await call(teams[name], kind, spec, payment.id);
        const label = `${kind} ${name} ${operation}`;
        if (allowed.includes(operation)) assert.equal(result.status, 400, label);
        else refused(result, 403, spec[0], 'forbidden', label);
      }
    }
    for (const name of ['desk', 'other']) {
      for (const spec of Object.values(operations)) {
        refused(
          await call(teams[name], kind, spec, payment.id),
          403,
          'Access denied.',
          'forbidden',
        );
      }
    }
  }
  const path = entryPath(teams.admin, 'payments', `/${payment.id}/approve`);
  const noCsrf = await request(path, { method: 'POST', cookie: teams.approver.cookie, body: {} });
  assert.equal(noCsrf.status, 403);
});

test('hidden, unknown, malformed and other-team rows give the identical 404', async () => {
  const { admin, agent, second, approver } = teams;
  const body = { payment: { receiptDate: payment.receiptDate, amountFils: 5 }, version: 1 };
  const targets = [
    [second, 'payments', payment.id, body],
    [agent, 'expenses', expense.id, { expense: expenseBody(), version: 1 }],
    [admin, 'payments', foreign.id, body],
    [admin, 'payments', UNKNOWN, body],
    [admin, 'payments', 'not-a-uuid', body],
  ];
  for (const [who, kind, id, patch] of targets) {
    const label = `${kind} ${id}`;
    refused(
      await call(who, kind, operations.edit, id, patch),
      404,
      ENTRY.missing.message,
      'not_found',
      label,
    );
    const history = await who.request(entryPath(admin, kind, `/${id}/history`));
    refused(history, 404, ENTRY.missing.message, 'not_found', `${label} history`);
  }
  for (const id of [foreign.id, UNKNOWN]) {
    const result = await call(approver, 'payments', operations.approve, id, { version: 1 });
    refused(result, 404, ENTRY.missing.message, 'not_found', id);
  }
  const held = await earnDeal(admin, await createDeal(second, await heldClient(second)));
  for (const dealId of [held.dealId, 'DL-999']) {
    const create = { method: 'POST', body: { payment: paymentBody(dealId) } };
    const result = await agent.request(entryPath(admin, 'payments'), create);
    refused(result, 409, ENTRY.dealMissing, 'link_missing', dealId);
  }
});

test('history: team view has actors and changes; the own view only a timeline', async () => {
  const { admin, agent, approver, second } = teams;
  const reject = await approver.request(entryPath(admin, 'payments', `/${payment.id}/reject`), {
    method: 'POST',
    body: { version: payment.version, reason: 'Synthetic slip missing' },
  });
  assert.equal(reject.status, 200);
  const history = async (who, kind, id) => {
    const result = await who.request(entryPath(admin, kind, `/${id}/history`));
    assert.equal(result.status, 200, JSON.stringify(result.value));
    return result.value.history;
  };
  const team = await history(approver, 'payments', payment.id);
  assert.deepEqual(
    team.map((row) => Object.keys(row).sort()),
    [
      ['action', 'actor', 'at', 'changes', 'reason'],
      ['action', 'actor', 'at', 'changes', 'reason'],
    ],
  );
  assert.deepEqual(team[1].actor, { id: approver.user.id, name: approver.user.name });
  assert.match(team[0].at, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  const own = await history(agent, 'payments', payment.id);
  assert.deepEqual(own, [
    { at: team[0].at, action: 'submitted', actor: { name: agent.user.name } },
    {
      at: team[1].at,
      action: 'rejected',
      actor: { name: approver.user.name },
      reason: 'Synthetic slip missing',
    },
  ]);
  const deal = await history(agent, 'deals', teams.deal.id);
  assert.deepEqual(
    deal.map((row) => row.action),
    ['created', 'earned'],
  );
  assert.ok(deal.every((row) => !('changes' in row) && !('id' in row.actor)));
  assert.equal((await history(admin, 'deals', teams.deal.id))[1].changes.netFils[1], 4_900_000);
  const hidden = await second.request(entryPath(admin, 'deals', `/${teams.deal.id}/history`));
  refused(hidden, 404, ENTRY.missing.message, 'not_found');
  const desk = await teams.desk.request(entryPath(admin, 'expenses', `/${expense.id}/history`));
  refused(desk, 403, 'Access denied.', 'forbidden');
  assert.equal((await history(second, 'expenses', expense.id))[0].action, 'submitted');
});
