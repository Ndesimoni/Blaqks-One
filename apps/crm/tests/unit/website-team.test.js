import assert from 'node:assert/strict';
import test from 'node:test';
import * as model from '../../src/features/server/website/team/websiteTeamModel.js';

const profile = (member, extra = {}) => ({
  id: `profile-${member}`,
  member,
  body: { name: `Public ${member}`, specialty: 'Marina apartments' },
  consent: true,
  canPublish: false,
  active: true,
  version: 3,
  ...extra,
});
const member = (id, extra = {}) => ({
  id,
  name: `Synthetic ${id}`,
  roleId: 'staff',
  active: true,
  status: 'active',
  permissions: { properties: true },
  ...extra,
});

test('status badges follow hidden, consent and set-up state in that order', () => {
  assert.equal(model.profileStatus(null), 'notSetUp');
  assert.equal(model.profileStatus(profile('a', { active: false })), 'hidden');
  assert.equal(model.profileStatus(profile('a', { active: false, consent: false })), 'hidden');
  assert.equal(model.profileStatus(profile('a', { consent: false })), 'waiting');
  assert.equal(model.profileStatus(profile('a')), 'public');
  assert.equal(model.STATUS_TONES.waiting, 'amber');
  assert.equal(model.STATUS_TONES.public, 'green');
});

test('only shown, agreed profiles with a grant (or the Admin) may be listing agents', () => {
  assert.equal(model.canPublishAsAgent(profile('a', { canPublish: true }), false), true);
  assert.equal(model.canPublishAsAgent(profile('a'), false), false);
  assert.equal(model.canPublishAsAgent(profile('a'), true), true);
  assert.equal(model.canPublishAsAgent(profile('a', { consent: false }), true), false);
  assert.equal(model.canPublishAsAgent(profile('a', { active: false, canPublish: true })), false);
  assert.equal(model.canPublishAsAgent(null, true), false);
});

test('live listings count active publications per agent profile', () => {
  const counts = model.liveCounts([
    { agentProfileId: 'p1', active: true },
    { agentProfileId: 'p1', active: true },
    { agentProfileId: 'p1', active: false },
    { agentProfileId: 'p2', active: true },
    { agentProfileId: null, active: true },
  ]);
  assert.deepEqual(counts, { p1: 2, p2: 1 });
  assert.deepEqual(model.liveCounts(undefined), {});
});

test('team rows put the signed-in Admin first, then current staff with status and live count', () => {
  const viewer = { id: 'boss', name: 'Synthetic Zara Admin', roleId: 'admin' };
  const rows = model.teamRows({
    members: [
      member('zed'),
      member('amy', { permissions: {} }),
      member('boss', { roleId: 'admin', name: 'Synthetic Zara Admin', permissions: {} }),
      member('invited', { invitationPending: true, status: 'invited' }),
      member('gone', { status: 'archived' }),
      member('paused', { active: false }),
    ],
    profiles: [profile('zed', { consent: false }), profile('boss')],
    publications: [{ agentProfileId: 'profile-boss', active: true }],
    viewer,
  });
  assert.deepEqual(
    rows.map((row) => row.member.id),
    ['boss', 'amy', 'zed'],
  );
  const [admin, amy, zed] = rows;
  assert.equal(admin.own, true);
  assert.equal(admin.admin, true);
  assert.equal(admin.eligible, true);
  assert.equal(admin.live, 1);
  assert.equal(admin.status, 'public');
  assert.equal(amy.eligible, false);
  assert.equal(amy.status, 'notSetUp');
  assert.equal(amy.profile, null);
  assert.equal(zed.status, 'waiting');
  assert.equal(zed.live, 0);
  assert.equal(zed.own, false);
  // The Admin's team list holds only staff; the session user still gets their own row.
  const alone = model.teamRows({ members: [member('zed')], profiles: [], viewer });
  assert.deepEqual(
    alone.map((row) => [row.member.id, row.admin, row.status]),
    [
      ['boss', true, 'notSetUp'],
      ['zed', false, 'notSetUp'],
    ],
  );
});
