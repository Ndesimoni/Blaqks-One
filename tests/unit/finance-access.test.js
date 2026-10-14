import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canFinance,
  canUseFinance,
  financeDeniedMessages,
  noFinanceAccess,
  readFinanceAccess,
} from '../../src/features/server/finance/financeAccess.js';
import {
  approvedEntryMessage,
  archivedMessage,
  decidedMessage,
  earnedDealMessage,
  financeRefusal,
  reasonError,
  reasonMessage,
  selfReviewMessage,
} from '../../src/features/server/finance/financeRules.js';

const all = { create: true, edit: true, assign: true, approve: true, teamView: true };
const admin = { roleId: 'admin', financeAccess: { scope: 'team', ...all, manage: true } };
const agent = {
  roleId: 'staff',
  financeAccess: { scope: 'own', ...all, approve: false, teamView: false, manage: false },
};

test('finance access is denied by default for missing or malformed profiles', () => {
  for (const user of [
    null,
    undefined,
    {},
    { roleId: 'staff' },
    { roleId: 'staff', financeAccess: null },
    { roleId: 'staff', financeAccess: 'team' },
    { roleId: 'staff', financeAccess: { ...all, manage: true } },
    { roleId: 'staff', financeAccess: { scope: 'none', ...all } },
    { roleId: 'viewer', financeAccess: admin.financeAccess },
    { financeAccess: admin.financeAccess },
  ]) {
    assert.deepEqual(readFinanceAccess(user), noFinanceAccess, JSON.stringify(user));
    assert.equal(canUseFinance(user), false);
  }
  for (const flag of ['create', 'edit', 'assign', 'approve', 'teamView', 'manage'])
    assert.equal(canFinance({}, flag), false, flag);
});

test('only JSON true grants a flag and inconsistent flags narrow, never widen', () => {
  assert.deepEqual(readFinanceAccess(admin), { scope: 'team', ...all, manage: true });
  const strings = { roleId: 'staff', financeAccess: { scope: 'own', create: 'true', edit: 1 } };
  assert.deepEqual(readFinanceAccess(strings), { ...noFinanceAccess, scope: 'own' });
  const ownApprover = { ...agent, financeAccess: { ...agent.financeAccess, approve: true } };
  assert.equal(readFinanceAccess(ownApprover).approve, false, 'approve needs team view');
  const ownTeamView = { ...agent, financeAccess: { ...agent.financeAccess, teamView: true } };
  assert.equal(readFinanceAccess(ownTeamView).scope, 'own', 'own scope never gains team view');
  const teamNoView = { roleId: 'staff', financeAccess: { scope: 'team', create: true } };
  assert.deepEqual(readFinanceAccess(teamNoView), {
    ...noFinanceAccess,
    scope: 'own',
    create: true,
  });
  const staffManage = { ...agent, financeAccess: { ...agent.financeAccess, manage: true } };
  assert.equal(readFinanceAccess(staffManage).manage, false, 'manage is the Admin role only');
  const superAdmin = {
    roleId: 'super-admin',
    financeAccess: { scope: 'team', teamView: true, manage: true },
  };
  assert.deepEqual(readFinanceAccess(superAdmin), {
    ...noFinanceAccess,
    scope: 'team',
    teamView: true,
  });
  assert.equal(canFinance(admin, 'approve'), true);
  assert.equal(canFinance(admin, 'delete'), false, 'unknown flags deny');
  assert.equal(canFinance(agent, 'approve'), false);
});

const access = (user) => readFinanceAccess(user);
const row = (allowed, extra = {}) => ({ id: 'r', version: 1, allowed, ...extra });

test('refusals use the caller grant first, then the row allowed flags', () => {
  assert.equal(financeRefusal(noFinanceAccess, 'createDeal'), financeDeniedMessages.module);
  assert.equal(financeRefusal(access(admin), 'unknownOperation'), financeDeniedMessages.module);
  assert.equal(financeRefusal(access(admin), 'createDeal', null, true), archivedMessage);
  assert.equal(financeRefusal(access(agent), 'createDeal'), '');
  assert.equal(financeRefusal(access(agent), 'saveSettings'), financeDeniedMessages.manage);
  assert.equal(
    financeRefusal(access(agent), 'approveEntry', row({ approve: true })),
    financeDeniedMessages.approve,
  );
  assert.equal(
    financeRefusal(access(agent), 'voidEntry', row({ void: true })),
    financeDeniedMessages.manage,
  );
  assert.equal(
    financeRefusal(access(admin), 'editDeal'),
    financeDeniedMessages.edit,
    'needs a row',
  );
  assert.equal(financeRefusal(access(admin), 'editDeal', { id: 'r' }), financeDeniedMessages.edit);
  assert.equal(financeRefusal(access(admin), 'editDeal', row({ edit: true })), '');
  assert.equal(
    financeRefusal(access(admin), 'editDeal', row({ edit: 'true' })),
    financeDeniedMessages.edit,
  );
});

test('row refusals carry the server’s target-dependent messages', () => {
  const deny = row({});
  const refuse = (operation, extra) =>
    financeRefusal(access(admin), operation, { ...deny, ...extra });
  assert.equal(refuse('editDeal', { earnedOn: '2026-10-01' }), earnedDealMessage);
  assert.equal(refuse('editEntry', { status: 'approved' }), approvedEntryMessage);
  assert.equal(refuse('editEntry', { status: 'void' }), approvedEntryMessage);
  assert.equal(refuse('approveEntry', { status: 'pending' }), selfReviewMessage);
  assert.equal(refuse('rejectEntry', { status: 'approved' }), decidedMessage);
  assert.equal(refuse('earnDeal', { earnedOn: null }), selfReviewMessage);
  assert.equal(refuse('assignDeal', {}), financeDeniedMessages.assign);
});

test('reasons are 1 to 500 characters after trimming, counted by code point', () => {
  for (const good of ['x', ' Duplicate receipt ', '😀'.repeat(500), 'a'.repeat(500)])
    assert.equal(reasonError(good), '');
  for (const bad of ['', '   ', 'a'.repeat(501), null, undefined, 5])
    assert.equal(reasonError(bad), reasonMessage, String(bad));
});
