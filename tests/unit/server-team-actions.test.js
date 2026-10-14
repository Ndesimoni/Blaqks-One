import test from 'node:test';
import assert from 'node:assert/strict';
import {
  actionsAfterAccessChange,
  deleteMainBlocker,
  emptyActions,
  modulePreset,
  normaliseActions,
  positionDefaultActions,
} from '../../src/features/server-team/actionModel.js';
import { blankMember, memberPayload } from '../../src/features/server-team/model.js';

const full = { create: true, edit: true, assign: true, deleteActivity: true };
const roles = [
  {
    id: 'agent',
    permissions: { relationships: true, schedule: true },
    actions: {
      relationships: { create: true, edit: true, assign: true, deleteMain: false },
      schedule: full,
    },
  },
  {
    id: 'lister',
    permissions: { properties: true },
    actions: { properties: { ...full, deleteMain: false } },
  },
  { id: 'reader', permissions: { properties: true }, actions: { properties: {} } },
];
const allModules = { relationships: true, properties: true, schedule: true, finance: false };
const staff = (overrides = {}) => ({
  ...blankMember({ roleId: 'staff', positions: [], permissions: {} }),
  ...overrides,
});

test('presets OR selected positions and never grant deleteMain', () => {
  assert.deepEqual(modulePreset('properties', ['reader'], roles), {
    create: false,
    edit: false,
    assign: false,
    deleteActivity: false,
    deleteMain: false,
  });
  assert.deepEqual(modulePreset('properties', ['reader', 'lister'], roles), {
    ...full,
    deleteMain: false,
  });
  assert.equal(modulePreset('relationships', ['agent'], roles).deleteMain, false);
  // A module switched on by hand, with no granting position, takes the standard preset.
  assert.deepEqual(modulePreset('schedule', ['lister'], roles), full);
});

test('positions preset newly enabled modules but never widen an enabled module (M-D)', () => {
  const form = staff({ positions: ['reader'], permissions: { properties: true } });
  const narrowed = positionDefaultActions(form, roles);
  assert.equal(narrowed.properties.create, false);
  const next = {
    ...form,
    actions: { ...narrowed, properties: { ...narrowed.properties, edit: true } },
  };
  const permissions = { ...allModules, finance: false };
  const actions = actionsAfterAccessChange(next, permissions, ['reader', 'agent', 'lister'], roles);
  assert.deepEqual(actions.properties, { ...narrowed.properties, edit: true });
  assert.equal(actions.relationships.create, true);
  assert.deepEqual(actions.schedule, full);
  const reset = positionDefaultActions(
    { ...next, actions, permissions, positions: ['lister'] },
    roles,
  );
  assert.deepEqual(reset.properties, { ...full, deleteMain: false });
});

test('turning a module off clears its actions', () => {
  const form = staff({ permissions: allModules, recordScope: 'team' });
  form.actions = normaliseActions(
    {
      relationships: { create: true, deleteMain: true },
      properties: { ...full, deleteMain: true },
    },
    form,
  );
  const actions = actionsAfterAccessChange(form, { ...allModules, properties: false }, [], roles);
  assert.deepEqual(actions.properties, emptyActions().properties);
  // Contacts reference properties, so losing Properties also clears deleting clients & contacts.
  assert.equal(actions.relationships.deleteMain, false);
  assert.equal(actions.relationships.create, true);
});

test('deleteMain needs whole-team visibility and referencing-module coverage (M-C)', () => {
  const team = staff({ permissions: allModules, recordScope: 'team' });
  assert.equal(deleteMainBlocker('relationships', team), '');
  assert.equal(deleteMainBlocker('properties', team), '');
  const assigned = { ...team, recordScope: 'assigned' };
  assert.equal(deleteMainBlocker('relationships', assigned), 'Needs whole-team visibility');
  const noSchedule = { ...team, permissions: { ...allModules, schedule: false } };
  assert.equal(
    deleteMainBlocker('relationships', noSchedule),
    'Needs Scheduling and Properties access',
  );
  assert.equal(deleteMainBlocker('properties', noSchedule), 'Needs Scheduling access');
  const grants = { relationships: { deleteMain: true }, properties: { deleteMain: true } };
  assert.equal(normaliseActions(grants, team).relationships.deleteMain, true);
  assert.equal(normaliseActions(grants, assigned).relationships.deleteMain, false);
  assert.equal(normaliseActions(grants, assigned).properties.deleteMain, false);
  const noProperties = { ...team, permissions: { ...allModules, properties: false } };
  assert.equal(normaliseActions(grants, noProperties).relationships.deleteMain, false);
});

test('staff edits send a complete normalised actions object', () => {
  const member = {
    roleId: 'staff',
    version: 4,
    positions: ['agent'],
    permissions: { relationships: true, schedule: true },
    recordScope: 'team',
    actions: {
      relationships: { create: true, edit: 'yes', assign: true, deleteMain: true },
      schedule: full,
      properties: { create: true },
    },
  };
  const form = blankMember(member);
  assert.deepEqual(form.actions.relationships, {
    create: true,
    edit: false,
    assign: true,
    deleteMain: false,
  });
  assert.deepEqual(form.actions.properties, emptyActions().properties);
  const payload = memberPayload({ ...form, recordScope: 'assigned' }, member);
  assert.equal(payload.recordScope, 'assigned');
  assert.equal(payload.actions.relationships.deleteMain, false);
  assert.deepEqual(Object.keys(payload.actions).sort(), [
    'properties',
    'relationships',
    'schedule',
  ]);
});
