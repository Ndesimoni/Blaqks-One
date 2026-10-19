import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { api, login, origin, query, request } from './helpers.mjs';
import { activate, invite, teamPath } from './team-helpers.mjs';
import { updateAccount } from './account-helpers.mjs';
import {
  assertCompanyPayload,
  companyBody,
  companyPath,
  emptyCompany,
  newCompany,
  putCompany,
  readCompany,
  snapshot,
} from './company-helpers.mjs';

before(() => query('TRUNCATE crm_login_limits'));

test('company access follows live effective workspace, including staff with no module grants', async () => {
  const { owner, admin } = await newCompany('access');
  const other = await login('admin-b');
  const person = await invite(admin, 'company-access-staff', { permissions: {} });
  const staff = await activate(person);
  assert.ok(Object.values(staff.user.permissions).every((grant) => grant === false));
  for (const caller of [admin, staff]) assert.deepEqual(await readCompany(caller), emptyCompany);
  assert.deepEqual(await readCompany(owner), emptyCompany);
  for (const [caller, workspace] of [
    [admin, other.user.workspaceId],
    [staff, other.user.workspaceId],
    [staff, staff.user.id],
    [owner, admin.user.workspaceId],
    [owner, owner.user.id],
    [admin, 'unknown-workspace'],
  ])
    assert.equal((await caller.request(companyPath(caller, workspace))).status, 403);
  assert.equal((await request(companyPath(admin))).status, 401);
  const before = snapshot(admin.user.workspaceId);
  for (const [caller, workspace] of [
    [staff, admin.user.workspaceId],
    [owner, owner.user.workspaceId],
    [owner, admin.user.workspaceId],
    [other, admin.user.workspaceId],
    [admin, 'unknown-workspace'],
  ]) {
    const result = await caller.request(companyPath(caller, workspace), {
      method: 'PUT',
      body: companyBody(),
    });
    assert.equal(result.status, 403, `${caller.user.roleId} in ${workspace}`);
  }
  assert.equal(snapshot(admin.user.workspaceId), before);
});

test('company writes require exact Origin and the session-bound CSRF token', async () => {
  const { admin, owner } = await newCompany('protection');
  const before = snapshot(admin.user.workspaceId);
  for (const options of [
    { csrf: undefined },
    { csrf: owner.csrf },
    { headers: { Origin: `${origin}/path` } },
    { headers: { Origin: `${origin}.invalid` } },
    { headers: { Origin: '' } },
  ])
    assert.equal((await putCompany(admin, companyBody(), options)).status, 403);
  const missingOrigin = await fetch(`${api}${companyPath(admin)}`, {
    method: 'PUT',
    headers: {
      Cookie: admin.cookie,
      'X-CSRF-Token': admin.csrf,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(companyBody()),
  });
  assert.equal(missingOrigin.status, 403);
  for (const body of ['{bad', ' '.repeat(16384) + JSON.stringify(companyBody())]) {
    const response = await fetch(`${api}${companyPath(admin)}`, {
      method: 'PUT',
      headers: {
        Cookie: admin.cookie,
        Origin: origin,
        'X-CSRF-Token': admin.csrf,
        'Content-Type': 'application/json',
      },
      body,
    });
    assert.equal(response.status, 400, 'malformed and oversized valid JSON are refused');
  }
  assert.equal(
    (await request(companyPath(admin), { method: 'PUT', body: companyBody() })).status,
    401,
  );
  assert.equal(snapshot(admin.user.workspaceId), before);
});

test('own auth payloads share top-level company metadata without leaking it through team members', async () => {
  const { admin } = await newCompany('payload');
  const person = await invite(admin, 'company-payload-staff', { permissions: {} });
  const staff = await activate(person);
  const saved = await putCompany(admin, companyBody({ displayName: 'Synthetic Payload Company' }));
  assert.equal(saved.status, 200, JSON.stringify(saved.value));
  const expected = saved.value;
  for (const caller of [admin, staff]) {
    for (const path of ['/auth/session', '/auth/account']) {
      const result = await caller.request(path);
      assert.equal(result.status, 200);
      assertCompanyPayload(result.value, expected);
    }
  }
  const signedIn = await request('/auth/login', {
    method: 'POST',
    body: { email: person.email, password: 'Team123!' },
  });
  assert.equal(signedIn.status, 200);
  assertCompanyPayload(signedIn.value, expected);
  const account = (await staff.request('/auth/account')).value;
  const edited = await updateAccount(staff, {
    version: account.version,
    name: 'Synthetic Profile Edit',
  });
  assert.equal(edited.status, 200);
  assertCompanyPayload(edited.value, expected);
  const language = await staff.request('/auth/account/language', {
    method: 'PUT',
    body: { language: 'ar' },
  });
  assert.equal(language.status, 200);
  assertCompanyPayload(language.value, expected);
  const directory = await admin.request(teamPath(admin));
  assert.equal(directory.status, 200);
  assert.ok(directory.value.members.some((member) => member.id === staff.user.id));
  assert.doesNotMatch(
    JSON.stringify(directory.value.members),
    /"(?:company|accountType|memberLimit|displayName)"\s*:/,
  );
});
