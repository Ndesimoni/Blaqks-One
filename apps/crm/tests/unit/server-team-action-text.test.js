import test from 'node:test';
import assert from 'node:assert/strict';
import { blankMember, memberPayload, moduleLabels } from '../../src/features/server-team/model.js';
import {
  ARCHIVED_ACTIONS_TEXT,
  actionReview,
  archivedActionText,
} from '../../src/features/server-team/actionText.js';

const full = { create: true, edit: true, assign: true, deleteActivity: true };
const person = { name: 'Colleague', email: 'colleague@fixture.test', phone: '+971501234567' };
const allModules = { relationships: true, properties: true, schedule: true };

test('invitations send actions without deleteMain; Admins never send actions', () => {
  const form = {
    ...blankMember(),
    ...person,
    positions: ['agent'],
    permissions: { ...blankMember().permissions, ...allModules },
    recordScope: 'team',
    actions: {
      relationships: { create: true, edit: true, assign: true, deleteMain: true },
      properties: { ...full, deleteMain: true },
      schedule: full,
    },
  };
  const invite = memberPayload(form);
  assert.deepEqual(invite.actions.relationships, { create: true, edit: true, assign: true });
  assert.deepEqual(invite.actions.properties, full);
  assert.deepEqual(invite.actions.schedule, full);
  assert.equal('recordScope' in invite, false);
  const adminInvite = memberPayload({ ...form, accountRole: 'admin' });
  assert.equal('actions' in adminInvite, false);
  const admin = {
    ...person,
    roleId: 'admin',
    version: 2,
    permissions: allModules,
    actions: { relationships: { create: true, deleteMain: true } },
  };
  const adminForm = blankMember(admin);
  assert.equal(adminForm.actions.relationships.deleteMain, false);
  const adminEdit = memberPayload(adminForm, admin);
  assert.equal('actions' in adminEdit, false);
  assert.equal('recordScope' in adminEdit, false);
});

test('review lists actions in plain words and flags deleting main records as sensitive', () => {
  const form = {
    permissions: { ...allModules, finance: true },
    recordScope: 'team',
    actions: {
      relationships: { create: true, edit: true, assign: false, deleteMain: true },
      properties: { create: false, edit: false, assign: false, deleteActivity: false },
      schedule: { create: true, assign: true, deleteActivity: true },
    },
  };
  assert.deepEqual(actionReview(form, moduleLabels), [
    {
      module: 'relationships',
      label: 'Clients, leads and contacts',
      text: 'Add, Edit, Delete clients & contacts',
      sensitive: 'Delete clients & contacts',
    },
    { module: 'properties', label: 'Properties', text: 'View only', sensitive: '' },
    {
      module: 'schedule',
      label: 'Scheduling',
      text: 'Add, Hand on, Delete activity',
      sensitive: '',
    },
    { module: 'finance', label: 'Finance', text: 'View only', sensitive: '' },
  ]);
  const assigned = actionReview({ ...form, recordScope: 'assigned' }, moduleLabels);
  assert.equal(assigned[0].text, 'Add, Edit');
  assert.equal(assigned[0].sensitive, '');
  const offModule = actionReview({ ...form, permissions: { relationships: true } }, moduleLabels);
  assert.deepEqual(
    offModule.map((line) => line.module),
    ['relationships'],
  );
});

test('archived accounts without recorded actions are not shown as view only', () => {
  const base = { roleId: 'staff', permissions: allModules, recordScope: 'team' };
  assert.equal(archivedActionText({ ...base, actions: {} }, moduleLabels), ARCHIVED_ACTIONS_TEXT);
  assert.equal(archivedActionText(base, moduleLabels), ARCHIVED_ACTIONS_TEXT);
  assert.equal(ARCHIVED_ACTIONS_TEXT, 'Action access not recorded (archived before action grants)');
  const recorded = {
    ...base,
    permissions: { properties: true },
    actions: { properties: { create: true, deleteMain: true } },
  };
  assert.equal(archivedActionText(recorded, moduleLabels), 'Properties: Add');
  assert.equal(
    archivedActionText({ roleId: 'admin', actions: {} }, moduleLabels),
    'Admin · Every record action',
  );
});
