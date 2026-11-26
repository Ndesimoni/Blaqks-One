import assert from 'node:assert/strict';
import test from 'node:test';
import {
  displayNameProblem,
  eligibleMembers,
  localPartProblem,
  suggestLocalPart,
  withAdmin,
} from '../../src/features/server/channels/addressModel.js';

// E3d: the browser mirrors the server's address rules (integrations/addresses/rules.rs).
test('local parts are plain lower case and never role addresses', () => {
  for (const good of ['aidah', ' Simoni.N_2-b ', 'a'.repeat(64)]) {
    assert.equal(localPartProblem(good), '', good);
  }
  for (const bad of ['', '.a', 'a.', 'a..b', 'a b', 'a+b', 'a@b', 'عايدة', 'a'.repeat(65)]) {
    assert.equal(localPartProblem(bad), 'emailAddresses.localInvalid', bad);
  }
  assert.equal(localPartProblem('Postmaster'), 'emailAddresses.localRole');
  assert.equal(localPartProblem('no-reply'), 'emailAddresses.localRole');
});

test('display names cannot carry header syntax or hidden characters', () => {
  assert.equal(displayNameProblem(' Aidah · Keys '), '');
  assert.equal(displayNameProblem('عايدة'), '');
  for (const bad of ['', 'a\r\nBcc: x', '"Boss"', '<a@b.c>', 'ceo@bank.test', 'x‮y']) {
    assert.equal(displayNameProblem(bad), 'emailAddresses.nameInvalid', JSON.stringify(bad));
  }
  assert.equal(displayNameProblem('n'.repeat(81)), 'emailAddresses.nameInvalid');
});

test('only active members who may email and have no active address are offered', () => {
  const members = [
    { id: 'a', status: 'active', roleId: 'admin' },
    { id: 'b', status: 'active', roleId: 'staff', channelAccess: { email: true } },
    { id: 'c', status: 'active', roleId: 'staff', channelAccess: { email: false } },
    { id: 'd', status: 'suspended', roleId: 'staff', channelAccess: { email: true } },
    { id: 'e', status: 'active', roleId: 'staff', channelAccess: { email: true } },
  ];
  const addresses = [
    { memberId: 'b', state: 'active' },
    { memberId: 'e', state: 'reserved' },
  ];
  assert.deepEqual(
    eligibleMembers(members, addresses).map((member) => member.id),
    ['a', 'e'],
  );
  assert.equal(suggestLocalPart('Aidah Noor'), 'aidah.noor');
  assert.equal(suggestLocalPart('  José  Ñ  '), 'jose.n');
});

test('the signed-in Admin can give themselves an address', () => {
  const staff = [{ id: 's1', status: 'active', roleId: 'staff', channelAccess: { email: true } }];
  const admin = { id: 'a1', name: 'Aidah', roleId: 'admin' };
  const members = withAdmin(staff, admin);
  assert.deepEqual(
    members.map((member) => member.id),
    ['a1', 's1'],
  );
  assert.deepEqual(
    eligibleMembers(members, []).map((member) => member.id),
    ['a1', 's1'],
  );
  assert.equal(withAdmin(members, admin).length, 2, 'never listed twice');
});
