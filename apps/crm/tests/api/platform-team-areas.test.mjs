// BO1b area levels (docs/blaqks-one-console.md §8, owner 2026-11-05): each platform route
// checks the live saved level (reads View, writes Manage), access is validated against the
// fixed table, and an edit applies on the next request.
import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { query } from './helpers.mjs';
import { newCompany } from './company-helpers.mjs';
import {
  EVERYTHING,
  PRESETS,
  TEAM,
  expectNoTeam,
  teamBody,
  teamMember,
  teamRow,
} from './platform-team-helpers.mjs';
import { expectAccess } from './platform-team-routes.mjs';

let owner, admin;

before(async () => {
  query('TRUNCATE crm_login_limits');
  ({ owner, admin } = await newCompany('platform-areas'));
});

test('an Analyst views the dashboard and not the companies', async () => {
  const analyst = await teamMember(owner, 'platform-areas-analyst', 'analyst');
  assert.equal(analyst.user.role, 'Blaqks One · Analyst');
  assert.deepEqual(analyst.user.platformAccess, { dashboard: 'view' });
  const metrics = await analyst.request('/platform/metrics');
  assert.equal(metrics.status, 200, JSON.stringify(metrics.value));
  assert.equal((await analyst.request('/platform/companies')).status, 403);
  await expectAccess(analyst, admin, PRESETS.analyst);
});

test('view-only access reads every area it holds and changes nothing', async () => {
  const viewer = { companies: 'view', marketplace: 'view', platform_website: 'view' };
  const member = await teamMember(owner, 'platform-areas-viewer', 'custom', viewer);
  assert.equal(member.user.role, 'Blaqks One · Custom');
  assert.deepEqual(member.user.platformAccess, viewer);
  await expectAccess(member, admin, viewer);
});

test('a Manager reaches every platform route but never the team or company data', async () => {
  const manager = await teamMember(owner, 'platform-areas-manager', 'manager');
  assert.equal(manager.user.role, 'Blaqks One · Manager');
  assert.deepEqual(manager.user.platformAccess, EVERYTHING);
  await expectAccess(manager, admin, EVERYTHING);
  await expectNoTeam(manager, manager.user.id);
  const sales = await teamMember(owner, 'platform-areas-sales', 'sales');
  assert.equal(sales.user.role, 'Blaqks One · Sales');
  await expectAccess(sales, admin, PRESETS.sales);
});

test('access is checked against the fixed area table', async () => {
  const invite = (preset, access) =>
    owner.request(TEAM, {
      method: 'POST',
      body: teamBody('platform-areas-invalid', preset, access),
    });
  for (const [preset, access] of [
    ['custom', { companies: 'view', records: 'view' }],
    ['custom', { company_controls: 'manage' }],
    ['custom', { dashboard: 'manage' }],
    ['custom', { invite_admins: 'view' }],
    ['custom', { companies: 'off' }],
    ['custom', { companies: true }],
    ['custom', {}],
    ['platform_admin', { dashboard: 'view' }],
    ['support', ['companies']],
  ]) {
    const result = await invite(preset, access);
    const label = `${preset} ${JSON.stringify(access)}: ${JSON.stringify(result.value)}`;
    assert.equal(result.status, 400, label);
  }
  assert.equal(
    query(`SELECT count(*) FROM crm_users WHERE email='platform-areas-invalid@platform-team.test'`),
    '0',
    'nothing is written for a refused invitation',
  );
  const raw = await owner.request(TEAM, {
    method: 'POST',
    body: { ...teamBody('platform-areas-extra'), positions: ['receptionist'] },
  });
  assert.equal(raw.status, 400, 'company positions are never part of a platform invitation');
});

test('an access edit takes effect on the next request', async () => {
  const member = await teamMember(owner, 'platform-areas-edit', 'analyst');
  const { version } = await teamRow(owner, member.user.id);
  const path = `${TEAM}/${member.user.id}`;
  const edit = (body) => owner.request(path, { method: 'PATCH', body });
  const invalid = await edit({ version, preset: 'custom', access: { dashboard: 'manage' } });
  assert.equal(invalid.status, 400);
  const changed = await edit({ version, preset: 'support', access: { companies: 'manage' } });
  assert.equal(changed.status, 200, JSON.stringify(changed.value));
  assert.deepEqual(changed.value.member.access, { companies: 'manage' });
  assert.equal(changed.value.member.preset, 'support');
  assert.equal(changed.value.member.version, version + 1);
  assert.equal((await member.request('/platform/metrics')).status, 403);
  assert.equal((await member.request('/platform/companies')).status, 200, 'manage includes view');
  const session = await member.request('/auth/session');
  assert.equal(session.status, 200, 'an access edit keeps the person signed in');
  assert.deepEqual(session.value.user.platformAccess, { companies: 'manage' });
  assert.equal(session.value.user.role, 'Blaqks One · Support');
  const stale = await edit({ version, preset: 'analyst', access: PRESETS.analyst });
  assert.equal(stale.status, 409);
  assert.equal(
    query(`SELECT count(*) FROM crm_team_activity WHERE member_id='${member.user.id}'
      AND action='access_changed' AND actor_id='${owner.user.id}'`),
    '1',
    'the team feed records who changed whose access',
  );
});
