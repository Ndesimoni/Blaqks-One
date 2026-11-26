import assert from 'node:assert/strict';
import test from 'node:test';
import { DEMO_PASSWORD, DEMO_SESSION_KEY } from '../../src/config/demoAccounts.js';
import { TEAM_STORAGE, OWNER_ROLE } from '../../src/config/team.js';
import {
  initialTeam,
  setupOwner,
  inviteMember,
  activateMember,
  validatePerson,
  validPhone,
  normalizePhone,
  checkPreview,
  previewLink,
  memberStatus,
  renewInvitation,
  memberProfile,
  canVisit,
  editMember,
  verifyEmail,
  requestReset,
  finishReset,
  saveRole,
  removeRole,
  setMemberStatus,
  transferOwnership,
  validateTeam,
} from '../../src/features/team/model.js';
import { signInTeamDemo } from '../../src/services/auth/demoAuth.js';
import { createTeamRepository } from '../../src/services/storage/teamRepository.js';
import { createSessionRepository } from '../../src/services/storage/sessionRepository.js';

const now = Date.parse('2026-10-09T12:00:00Z');
const password = { password: DEMO_PASSWORD, confirmPassword: DEMO_PASSWORD };
const ownerForm = {
  name: 'Aidah',
  email: 'aidah@keyswithsimoni.test',
  phone: '+971 50 123 4567',
  ...password,
};
function configured() {
  return setupOwner(initialTeam(), ownerForm, 'new-owner', now).team;
}
function invited(team = configured(), id = 'staff-1', roleId = 'receptionist') {
  return inviteMember(
    team,
    'aidah',
    {
      name: 'Reception desk',
      email: `${id}@example.test`,
      roleId,
      channelAccess: { whatsapp: true, email: false },
    },
    id,
    now,
  ).team;
}
function active(team = invited(), id = 'staff-1') {
  const member = team.members.find((entry) => entry.id === id);
  return activateMember(
    team,
    id,
    member.inviteRevision,
    { ...member, phone: '+971 50 987 6543', whatsappUpdates: true, ...password },
    now,
  );
}

test('owner setup requires international phone and creates exactly one owner without losing demo identities', () => {
  assert.throws(
    () => setupOwner(initialTeam(), { ...ownerForm, phone: '0501234567' }, 'x', now),
    (error) => Boolean(error.fields.phone),
  );
  const team = configured();
  assert.equal(team.configured, true);
  assert.equal(team.members.filter((member) => member.roleId === OWNER_ROLE).length, 1);
  assert.equal(team.members[0].id, 'aidah');
  assert.equal(team.members[0].phone, '+971501234567');
  assert.equal(team.members.find((member) => member.id === 'simoni').status, 'invited');
  assert.throws(() => setupOwner(team, ownerForm, 'another'), /already/);
  assert.deepEqual(validateTeam(team), team);
  assert.equal(JSON.stringify(team).includes(DEMO_PASSWORD), false);
});

test('phone normalization and profile validation require country codes and reserve pending emails', () => {
  assert.equal(normalizePhone('00971 (50) 123-4567'), '+971501234567');
  for (const phone of ['0501234567', '+0123456789', '+1234', '+1234567890123456'])
    assert.equal(validPhone(phone), false);
  const team = configured();
  const person = { ...ownerForm, email: 'new@example.test', phone: '' };
  assert.ok(validatePerson(person).phone);
  assert.deepEqual(validatePerson(person, [], { phoneRequired: false }), {});
  const changed = editMember(
    team,
    'aidah',
    'aidah',
    { ...ownerForm, email: 'pending@example.test' },
    now,
  );
  assert.ok(
    validatePerson({ ...person, email: 'pending@example.test' }, changed.members, {
      phoneRequired: false,
    }).email,
  );
});

test('only owner invites non-owner roles and activation keeps assigned access while requiring phone', () => {
  let team = invited();
  const member = team.members.find((entry) => entry.id === 'staff-1');
  assert.throws(() => inviteMember(team, 'simoni', { ...member }, 'x', now), /Super Admin/);
  assert.throws(
    () =>
      inviteMember(
        team,
        'aidah',
        { ...member, email: 'owner@example.test', roleId: OWNER_ROLE },
        'x',
        now,
      ),
    /role/,
  );
  assert.throws(
    () => inviteMember(team, 'aidah', { ...member }, 'x', now),
    (error) => Boolean(error.fields.email),
  );
  assert.throws(
    () => activateMember(team, member.id, 1, { ...member, ...password }, now),
    (error) => Boolean(error.fields.phone),
  );
  team = activateMember(
    team,
    member.id,
    1,
    {
      ...member,
      phone: '+447700900123',
      roleId: OWNER_ROLE,
      channelAccess: { email: true },
      ...password,
    },
    now,
  );
  const profile = memberProfile(team, member.id);
  assert.equal(profile.role, 'Receptionist');
  assert.deepEqual(profile.channelAccess, { whatsapp: true, email: false });
  assert.equal(canVisit(profile, 'Deals'), false);
  assert.equal(canVisit(profile, 'Follow-ups'), true);
  assert.equal(canVisit(profile, 'Team & access'), false);
  assert.equal(canVisit(profile, 'My profile'), true);
  assert.throws(() => checkPreview(team, 'invite', member.id, 1, now), /no longer/);
});

test('invitation links expire and renew/revoke invalidates previously issued previews', () => {
  let team = invited();
  const member = team.members.find((entry) => entry.id === 'staff-1');
  assert.match(previewLink('invite', member), /revision=1$/);
  assert.equal(memberStatus(member, now), 'invited');
  assert.equal(memberStatus(member, now + 7 * 86400000), 'expired');
  assert.throws(() => checkPreview(team, 'invite', member.id, 1, now + 7 * 86400000), /expired/);
  team = renewInvitation(team, 'aidah', member.id, true, now);
  assert.throws(() => checkPreview(team, 'invite', member.id, 1, now), /no longer/);
  team = renewInvitation(team, 'aidah', member.id, false, now);
  assert.equal(checkPreview(team, 'invite', member.id, 3, now).status, 'invited');
  assert.throws(() => checkPreview(team, 'invite', member.id, 1, now), /no longer/);
});

test('members edit their own contacts without elevating roles or messaging access', () => {
  let team = active();
  const member = team.members.find((entry) => entry.id === 'staff-1');
  team = editMember(
    team,
    member.id,
    member.id,
    {
      ...member,
      name: 'Updated name',
      roleId: OWNER_ROLE,
      channelAccess: { whatsapp: true, email: true },
    },
    now,
  );
  assert.equal(memberProfile(team, member.id).role, 'Receptionist');
  assert.equal(memberProfile(team, member.id).channelAccess.email, false);
  assert.throws(() => editMember(team, member.id, 'aidah', ownerForm, now), /own profile/);
  team = setMemberStatus(team, 'aidah', member.id, 'suspended');
  assert.equal(memberProfile(team, member.id), null);
  assert.throws(() => editMember(team, member.id, member.id, member, now), /active account/);
  assert.throws(() => signInTeamDemo(team, member.email, DEMO_PASSWORD), /not active/);
  team = setMemberStatus(team, 'aidah', member.id, 'active');
  assert.equal(
    signInTeamDemo(team, member.email.toUpperCase(), DEMO_PASSWORD).name,
    'Updated name',
  );
});

test('email verification changes login only after preview completion and reset never saves a password', () => {
  let team = active();
  let member = team.members.find((entry) => entry.id === 'staff-1');
  team = editMember(team, member.id, member.id, { ...member, email: 'updated@example.test' }, now);
  assert.equal(signInTeamDemo(team, member.email, DEMO_PASSWORD).email, member.email);
  assert.throws(() => signInTeamDemo(team, 'updated@example.test', DEMO_PASSWORD), /incorrect/);
  team = verifyEmail(team, member.id, 1, now);
  assert.equal(
    signInTeamDemo(team, 'updated@example.test', DEMO_PASSWORD).email,
    'updated@example.test',
  );
  assert.throws(() => verifyEmail(team, member.id, 1, now), /no longer/);
  team = requestReset(team, 'aidah', member.id, now);
  assert.throws(
    () =>
      finishReset(
        team,
        member.id,
        1,
        { password: 'real-secret', confirmPassword: 'real-secret' },
        now,
      ),
    (error) => Boolean(error.fields.password),
  );
  team = finishReset(team, member.id, 1, password, now);
  assert.throws(() => finishReset(team, member.id, 1, password, now), /no longer/);
  assert.equal(JSON.stringify(validateTeam(team)).includes(DEMO_PASSWORD), false);
});

test('custom roles update assigned users immediately and cannot be removed until reassigned', () => {
  let team = configured();
  const permissions = {
    ...team.roles.find((role) => role.id === 'staff').permissions,
    properties: false,
  };
  team = saveRole(team, 'aidah', { name: 'Client assistant', permissions }, 'custom-1');
  team = active(invited(team, 'staff-1', 'custom-1'));
  assert.equal(memberProfile(team, 'staff-1').permissions.properties, false);
  assert.throws(() => removeRole(team, 'aidah', 'custom-1'), /Assign another/);
  team = saveRole(
    team,
    'aidah',
    { name: 'Client assistant', permissions: { ...permissions, properties: true } },
    'custom-1',
  );
  assert.equal(memberProfile(team, 'staff-1').permissions.properties, true);
  assert.throws(
    () => saveRole(team, 'staff-1', { name: 'Forged role', permissions }, 'forged'),
    /Super Admin/,
  );
  assert.throws(
    () => saveRole(team, 'aidah', { name: 'Admin', permissions }, 'custom-2'),
    /already/,
  );
  assert.throws(
    () => saveRole(team, 'aidah', { name: 'Changed', permissions }, 'admin'),
    /templates/,
  );
  const member = team.members.find((entry) => entry.id === 'staff-1');
  team = editMember(team, 'aidah', member.id, { ...member, roleId: 'staff' }, now);
  assert.equal(removeRole(team, 'aidah', 'custom-1').roles.length, 4);
});

test('ownership transfers only to an active member and preserves exactly one active owner', () => {
  let team = active();
  assert.throws(() => setMemberStatus(team, 'aidah', 'aidah', 'suspended'), /Transfer ownership/);
  assert.throws(() => transferOwnership(team, 'aidah', 'simoni'), /active member/);
  team = transferOwnership(team, 'aidah', 'staff-1');
  assert.equal(memberProfile(team, 'staff-1').managesTeam, true);
  assert.equal(memberProfile(team, 'aidah').role, 'Admin');
  assert.equal(
    validateTeam(team).members.filter((member) => member.roleId === OWNER_ROLE).length,
    1,
  );
  assert.throws(() => inviteMember(team, 'aidah', {}, 'x'), /Super Admin/);
});

test('team storage sanitizes fields and rejects corrupt schemas while preserving raw data', () => {
  const team = active();
  team.members[0].password = 'never-save';
  team.members[0].channelAccess.accessToken = 'never-save';
  team.members[0].pendingEmail = {
    value: 'pending@example.test',
    expiresAt: new Date(now + 86400000).toISOString(),
    password: 'never-save',
  };
  team.members[0].emailRevision = 1;
  const entries = new Map([
    ['kws-crm-v1', 'existing CRM'],
    ['kws-crm-preferences', 'dark theme'],
  ]);
  const storage = {
    getItem: (key) => entries.get(key) ?? null,
    setItem: (key, value) => entries.set(key, value),
  };
  const repository = createTeamRepository(() => storage);
  assert.equal(repository.read().team.configured, false);
  assert.equal(entries.has(TEAM_STORAGE), false);
  repository.save(team);
  assert.equal(entries.get(TEAM_STORAGE).includes('never-save'), false);
  assert.equal(entries.get('kws-crm-v1'), 'existing CRM');
  assert.equal(entries.get('kws-crm-preferences'), 'dark theme');
  for (const mutate of [
    (value) =>
      value.members.push({
        ...value.members[0],
        id: 'duplicate-owner',
        email: 'owner-2@example.test',
      }),
    (value) => (value.roles[0].permissions.exports = false),
    (value) =>
      (value.members[1].pendingEmail = {
        value: 'pending@example.test',
        expiresAt: new Date(now + 86400000).toISOString(),
      }),
    (value) => (value.members[0].phone = ''),
  ]) {
    const value = structuredClone(team);
    mutate(value);
    assert.throws(() => validateTeam(value));
  }
  for (const raw of [
    '',
    '{broken',
    'null',
    JSON.stringify({ version: 1, configured: true, roles: [], members: [] }),
  ]) {
    entries.set(TEAM_STORAGE, raw);
    const recovery = repository.read();
    assert.ok(recovery.error);
    assert.equal(recovery.raw, raw);
    assert.equal(entries.get(TEAM_STORAGE), raw);
  }
  assert.throws(
    () =>
      createTeamRepository(() => ({
        setItem() {
          throw Error('quota');
        },
      })).save(team),
    /quota/,
  );
});

test('session identity resolves current team roles and suspended users cannot resume', () => {
  let team = active();
  let raw = null;
  const storage = {
    getItem: () => raw,
    setItem: (key, value) => {
      assert.equal(key, DEMO_SESSION_KEY);
      raw = value;
    },
    removeItem: () => {
      raw = null;
    },
  };
  const repository = createSessionRepository(
    () => storage,
    (id) => memberProfile(team, id),
  );
  repository.save('staff-1');
  assert.deepEqual(JSON.parse(raw), { version: 1, adminId: 'staff-1' });
  assert.equal(repository.load().role, 'Receptionist');
  team = setMemberStatus(team, 'aidah', 'staff-1', 'suspended');
  assert.equal(repository.load(), null);
  assert.throws(() => repository.save('staff-1'), /Unknown/);
});
