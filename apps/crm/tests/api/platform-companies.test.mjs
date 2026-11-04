import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { query } from './helpers.mjs';
import { companyBody, newCompany, putCompany } from './company-helpers.mjs';

before(() => query('TRUNCATE crm_login_limits'));

const list = (session) => session.request('/platform/companies');

test('the Super Admin lists each company with its Admin, seats and marketplace state', async () => {
  const { owner, admin } = await newCompany('platform-list');
  const saved = await putCompany(admin, companyBody({ displayName: 'Synthetic Platform Homes' }));
  assert.equal(saved.status, 200);
  const result = await list(owner);
  assert.equal(result.status, 200, JSON.stringify(result.value));
  const row = result.value.companies.find((entry) => entry.id === admin.user.workspaceId);
  assert.deepEqual(
    {
      name: row.name,
      admin: row.admin,
      status: row.status,
      seatsUsed: row.seatsUsed,
      seatLimit: row.seatLimit,
      marketplace: row.marketplace,
    },
    {
      name: 'Synthetic Platform Homes',
      admin: admin.user.name,
      status: 'active',
      seatsUsed: 1,
      seatLimit: 3,
      marketplace: 'not_applied',
    },
  );
  assert.match(row.createdOn, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(
    result.value.companies.some((entry) => entry.id === owner.user.workspaceId),
    false,
    "the platform's own workspace is not a company",
  );
  assert.doesNotMatch(JSON.stringify(result.value), /email|password|phone|csrf/i);
});

test('company Admins cannot read the platform company list', async () => {
  const { admin } = await newCompany('platform-refused');
  const result = await list(admin);
  assert.equal(result.status, 403);
});
