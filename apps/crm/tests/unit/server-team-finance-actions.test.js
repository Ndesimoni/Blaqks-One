import test from 'node:test';
import assert from 'node:assert/strict';
import {
  actionBlocker,
  actionsAfterAccessChange,
  deleteMainBlocker,
  modulePreset,
  normaliseActions,
  positionDefaultActions,
} from '../../src/features/server-team/actionModel.js';
import {
  actionHelp,
  actionReview,
  invitationNote,
} from '../../src/features/server-team/actionText.js';
import { blankMember, memberPayload, moduleLabels } from '../../src/features/server-team/model.js';

const preset = { create: true, edit: true, assign: true, teamView: false, approve: false };
const all = { create: true, edit: true, assign: true, teamView: true, approve: true };
const modules = { relationships: true, properties: true, schedule: true, finance: true };
const accountant = {
  id: 'accountant',
  permissions: { finance: true },
  actions: { finance: preset },
};
const member = (overrides = {}) => ({
  roleId: 'staff',
  version: 3,
  name: 'Synthetic Finance',
  phone: '+971501234567',
  positions: ['accountant'],
  permissions: modules,
  recordScope: 'team',
  actions: { finance: all },
  ...overrides,
});

test('See team finance needs whole-team visibility and Approve also needs See team finance', () => {
  const form = blankMember(member());
  assert.deepEqual(form.actions.finance, all);
  const assigned = { ...form, recordScope: 'assigned' };
  for (const key of ['teamView', 'approve'])
    assert.equal(actionBlocker('finance', key, assigned), 'Needs whole-team visibility');
  const noView = { ...form, actions: { ...form.actions, finance: { ...all, teamView: false } } };
  assert.equal(actionBlocker('finance', 'approve', noView), 'Needs See team finance');
  assert.equal(actionBlocker('finance', 'teamView', noView), '');
  assert.equal(actionBlocker('finance', 'create', assigned), '');
  assert.match(actionHelp('finance', 'teamView', form), /^Sensitive: shows every teammate/);
  assert.equal(actionHelp('finance', 'approve', noView), 'Needs See team finance');
});

test('clearing rules: assigned visibility, losing See team finance and the module', () => {
  const form = blankMember(member());
  assert.deepEqual(normaliseActions(form.actions, { ...form, recordScope: 'assigned' }).finance, {
    ...all,
    teamView: false,
    approve: false,
  });
  const withoutView = { ...form.actions, finance: { ...all, teamView: false } };
  assert.equal(normaliseActions(withoutView, form).finance.approve, false);
  const off = actionsAfterAccessChange(form, { ...modules, finance: false }, form.positions, []);
  assert.deepEqual(Object.values(off.finance), [false, false, false, false, false]);
});

test('positions and defaults never tick See team finance or Approve', () => {
  assert.deepEqual(modulePreset('finance', ['accountant'], [accountant]), preset);
  assert.deepEqual(modulePreset('finance', [], []), preset);
  const form = { ...blankMember(member()), recordScope: 'team' };
  assert.deepEqual(positionDefaultActions(form, [accountant]).finance, preset);
  const fresh = { ...form, permissions: { ...modules, finance: false } };
  fresh.actions = normaliseActions(fresh.actions, fresh);
  const on = actionsAfterAccessChange(fresh, modules, ['accountant'], [accountant]);
  assert.deepEqual(on.finance, preset);
});

test('PATCH sends the complete finance object for staff only; invitations omit sensitive ticks', () => {
  const staff = member();
  const update = memberPayload(blankMember(staff), staff);
  assert.deepEqual(update.actions.finance, all);
  assert.deepEqual(Object.keys(update.actions.finance).sort(), [
    'approve',
    'assign',
    'create',
    'edit',
    'teamView',
  ]);
  const admin = member({ roleId: 'admin', actions: { finance: all } });
  const adminForm = blankMember(admin);
  assert.equal('actions' in memberPayload(adminForm, admin), false);
  const invite = memberPayload({
    ...blankMember(),
    name: 'Synthetic Invite',
    email: 'invite@fixture.test',
    phone: '+971501234567',
    positions: ['accountant'],
    permissions: { ...blankMember().permissions, finance: true },
    actions: { ...blankMember().actions, finance: all },
  });
  assert.deepEqual(invite.actions.finance, { create: true, edit: true, assign: true });
  assert.match(invitationNote('finance'), /granted later, with whole-team visibility/);
});

test('grants recorded before finance take the finance preset', () => {
  const legacy = member({ actions: { relationships: { create: true } } });
  assert.deepEqual(blankMember(legacy).actions.finance, preset);
});

test('deleting clients and properties also needs See team finance (owner Q9)', () => {
  const form = blankMember(member({ actions: { finance: preset } }));
  assert.equal(deleteMainBlocker('properties', form), 'Needs See team finance under Finance');
  assert.equal(deleteMainBlocker('relationships', form), '');
  assert.match(actionHelp('relationships', 'deleteMain', form), /until then this deletes contacts/);
  const grants = { ...form.actions, relationships: { deleteMain: true } };
  const kept = normaliseActions({ ...grants, properties: { deleteMain: true } }, form);
  assert.equal(kept.relationships.deleteMain, true);
  assert.equal(kept.properties.deleteMain, false);
  const viewing = { ...form, actions: { ...form.actions, finance: { ...preset, teamView: true } } };
  assert.equal(deleteMainBlocker('properties', viewing), '');
  assert.equal(
    actionHelp('relationships', 'deleteMain', viewing),
    actionHelp('properties', 'deleteMain', viewing),
  );
});

test('review flags See team finance and Approve as sensitive', () => {
  const form = blankMember(member());
  const finance = actionReview(form, moduleLabels).find((line) => line.module === 'finance');
  assert.deepEqual(finance, {
    module: 'finance',
    label: 'Finance',
    text: 'Add, Edit, Hand on, See team finance, Approve payments & expenses',
    sensitive: 'See team finance, Approve payments & expenses',
  });
});
