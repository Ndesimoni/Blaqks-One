import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { ok, put, setup } from './website-helpers.mjs';

const LIST = '/platform/websites/companies';
let t;
before(async () => {
  t = await setup('companies');
});

test('the Super Admin lists company websites with setup flags and no content', async () => {
  const { sites } = ok(await t.owner.request(LIST));
  const mine = sites.find((site) => site.workspace === t.admin.user.workspaceId);
  assert.deepEqual(Object.keys(mine).sort(), [
    'active',
    'entitled',
    'host',
    'licenceVerified',
    'name',
    'version',
    'workspace',
  ]);
  assert.equal(mine.name, t.a.name);
  assert.equal(mine.entitled, true);
  assert.equal(mine.licenceVerified, true);
  assert.equal(mine.version, t.a.version);
  assert.ok(sites.some((site) => site.workspace === t.other.user.workspaceId));
});

test('the listed version updates eligibility and Admins or staff cannot read the list', async () => {
  const before = ok(await t.owner.request(LIST)).sites.find(
    (site) => site.workspace === t.other.user.workspaceId,
  );
  const path = `${LIST}/${t.other.user.workspaceId}/eligibility`;
  const body = { version: before.version, entitled: false, licenceVerified: true };
  const changed = ok(await put(t.owner, path, body)).site;
  assert.equal(changed.entitled, false);
  const after = ok(await t.owner.request(LIST)).sites.find(
    (site) => site.workspace === t.other.user.workspaceId,
  );
  assert.equal(after.version, before.version + 1);
  assert.equal((await put(t.owner, path, body)).status, 409);
  for (const session of [t.admin, t.one]) {
    assert.equal((await session.request(LIST)).status, 403);
  }
});
