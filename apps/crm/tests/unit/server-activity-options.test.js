import test from 'node:test';
import assert from 'node:assert/strict';
import {
  actionOptions,
  sectionOptions,
} from '../../src/features/server/activity/activityVocabulary.js';
import { activityLabel } from '../../src/features/server/access.js';

test('section and action choices mirror the member grants', () => {
  const canOpen = (name) => ['Clients', 'Contacts', 'Leads'].includes(name);
  const admin = { roleId: 'admin' };
  assert.equal(sectionOptions(admin, () => false).length, 12);
  const own = { roleId: 'staff', recordScope: 'assigned', financeAccess: { scope: 'own' } };
  assert.deepEqual(sectionOptions(own, canOpen), [
    'Clients',
    'Contacts',
    'Deals',
    'Payments',
    'Expenses',
  ]);
  const team = { ...own, recordScope: 'team', permissions: { reports: true } };
  assert.deepEqual(sectionOptions(team, canOpen), ['Clients', 'Contacts', 'Targets']);
  const values = (options) => options.map((option) => option.value);
  assert.ok(!values(actionOptions('', false)).includes('invited'));
  assert.ok(values(actionOptions('', true)).includes('invited'));
  assert.equal(new Set(values(actionOptions('', true))).size, actionOptions('', true).length);
  assert.equal(activityLabel(admin), 'Team activity');
  assert.equal(activityLabel(own), 'My activity');
});
