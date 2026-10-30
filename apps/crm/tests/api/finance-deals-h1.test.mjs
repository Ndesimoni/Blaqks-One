import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { request } from './helpers.mjs';
import { refused } from './finance-helpers.mjs';
import {
  DEAL_MESSAGES as M,
  UNKNOWN,
  createDeal,
  dealBody,
  dealPath,
} from './finance-deals-helpers.mjs';
import { dealTeams, heldClient } from './finance-deals-helpers.mjs';

let teams, deal, foreign;
before(async () => {
  teams = await dealTeams('fin-h1');
  deal = await createDeal(teams.agent, await heldClient(teams.agent));
  foreign = await createDeal(teams.other, await heldClient(teams.other));
});

/** Every deal write with an invalid body: callers lacking the grant get their 403 first. */
const operations = {
  create: [M.create, 'POST', null],
  edit: [M.edit, 'PATCH', ''],
  split: [M.manage, 'PUT', '/split'],
  earn: [M.approve, 'POST', '/earn'],
  revise: [M.manage, 'POST', '/revise'],
  unearn: [M.manage, 'POST', '/unearn'],
  delete: [M.manage, 'DELETE', ''],
  assignee: [M.manage, 'PUT', '/assignee'],
  handover: [M.assign, 'POST', '/handovers'],
};
const call = (session, [, method, suffix], id) =>
  session.request(dealPath(teams.admin, suffix === null ? '' : `/${id}${suffix}`), {
    method,
    body: {},
  });
// Which callers hold each operation's grant (they reach the 400).
const granted = {
  admin: Object.keys(operations),
  agent: ['create', 'edit', 'handover'],
  second: ['create', 'edit', 'handover'],
  viewer: ['create', 'edit', 'handover'],
  approver: ['create', 'edit', 'handover', 'earn'],
  owner: [],
};

test('H1: module, then grant or role (403) before any body (400)', async () => {
  for (const [name, allowed] of Object.entries(granted)) {
    for (const [operation, spec] of Object.entries(operations)) {
      const result = await call(teams[name], spec, deal.id);
      const label = `${name} ${operation}`;
      if (allowed.includes(operation))
        assert.equal(result.status, 400, `${label} ${JSON.stringify(result.value)}`);
      else refused(result, 403, spec[0], 'forbidden', label);
    }
  }
  for (const [operation, spec] of Object.entries(operations)) {
    for (const name of ['desk', 'other']) {
      const result = await call(teams[name], spec, deal.id);
      refused(result, 403, M.denied, 'forbidden', `${name} ${operation}`);
    }
  }
  const noCsrf = await request(dealPath(teams.admin), {
    method: 'POST',
    cookie: teams.admin.cookie,
    body: { deal: dealBody('CL-001') },
  });
  assert.equal(noCsrf.status, 403);
});

test('H1: hidden, unknown, malformed and cross-team deals give one identical 404', async () => {
  const { second, admin } = teams;
  const valid = {
    edit: (id) => ({ method: 'PATCH', suffix: '', body: { version: 1, deal: dealBody('CL-404') } }),
    handover: () => ({
      method: 'POST',
      suffix: '/handovers',
      body: { version: 1, toId: second.user.id, referralShareBp: null },
    }),
  };
  for (const id of [deal.id, UNKNOWN, 'not-a-uuid', foreign.id]) {
    for (const [name, make] of Object.entries(valid)) {
      const { method, suffix, body } = make(id);
      const result = await second.request(dealPath(admin, `/${id}${suffix}`), { method, body });
      refused(result, 404, M.missing.message, M.missing.code, `${name} ${id}`);
    }
    const adminCalls = [
      [
        'PUT',
        '/split',
        {
          version: 1,
          secondAgentId: null,
          secondAgentShareBp: null,
          overrideAgentShareBp: null,
          reason: null,
        },
      ],
      ['POST', '/earn', { version: 1, earnedOn: '2026-01-01' }],
      ['POST', '/unearn', { version: 1, reason: 'Synthetic' }],
      ['PUT', '/assignee', { version: 1, assigneeId: null, reason: 'Synthetic' }],
      ['DELETE', '', { version: 1 }],
    ];
    if (id === deal.id) continue;
    for (const [method, suffix, body] of adminCalls) {
      const result = await admin.request(dealPath(admin, `/${id}${suffix}`), { method, body });
      refused(result, 404, M.missing.message, M.missing.code, `admin ${suffix} ${id}`);
    }
  }
  const preview = await teams.approver.request(
    dealPath(admin, `/${UNKNOWN}/earn-preview?earnedOn=2026-01-01`),
  );
  refused(preview, 404, M.missing.message, M.missing.code, 'preview');
  const agentPreview = await teams.agent.request(
    dealPath(admin, `/${deal.id}/earn-preview?earnedOn=2026-01-01`),
  );
  refused(agentPreview, 403, M.approve, 'forbidden', 'preview grant');
});

test('Deals stay outside the generic record and assignment endpoints (L-F2)', async () => {
  const { admin } = teams;
  const records = `/workspaces/${admin.user.workspaceId}/records`;
  const create = await admin.request(`${records}/Deals`, { method: 'POST', body: { record: {} } });
  assert.equal(create.status, 400);
  const assign = await admin.request(`${records}/Deals/${deal.id}/assignee`, {
    method: 'PUT',
    body: { version: 1, assigneeId: null },
  });
  assert.equal(assign.status, 400);
  const listed = await admin.request(records);
  assert.equal(listed.status, 200);
  assert.ok(!('Deals' in listed.value.records), 'GET records is unchanged');
  const people = await admin.request(
    `/workspaces/${admin.user.workspaceId}/assignees?collection=Deals`,
  );
  assert.equal(people.status, 400);
});
