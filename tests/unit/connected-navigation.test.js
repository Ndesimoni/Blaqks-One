import assert from 'node:assert/strict';
import test from 'node:test';
import {
  connectedGroups,
  displayGroups,
  navIcons,
  navLabel,
} from '../../src/features/server/connectedNav.js';

const modules = ['relationships', 'properties', 'schedule', 'finance', 'reports', 'exports'];
const full = Object.fromEntries(modules.map((name) => [name, true]));
const names = (groups) => groups.flatMap((group) => group.items);
const itemsOf = (groups, key) => groups.find((group) => group.key === key)?.items || [];

test('every standard navigation entry has an icon instead of falling back to the dashboard', () => {
  for (const name of new Set(names(displayGroups))) {
    if (name === 'Inbox' || name === 'Team chat') continue;
    assert.equal(typeof navIcons[name], 'string', `${name} must keep its own icon`);
    if (name !== 'Dashboard') assert.notEqual(navIcons[name], 'grid', name);
  }
});

test('connected groups separate daily work from account and administration, once per route', () => {
  const admin = {
    roleId: 'admin',
    permissions: full,
    channelAccess: { email: true, whatsapp: true },
  };
  const groups = connectedGroups(admin);
  assert.deepEqual(
    groups.map((group) => group.key),
    [
      'overview',
      'relationships',
      'inventory',
      'work',
      'finance',
      'resources',
      'personal',
      'company',
    ],
  );
  assert.equal(names(groups).filter((name) => name === 'Workspaces').length, 1);
  assert.equal(names(groups).filter((name) => name === 'Team activity').length, 1);
  assert.ok(itemsOf(groups, 'company').includes('Workspaces'));
  assert.ok(itemsOf(groups, 'company').includes('Team activity'));
  assert.ok(!names(groups).includes('Messages'), 'Inbox replaces the demo preview');
  assert.ok(!names(groups).includes('Marketplace applications'));
});

test('staff see their own activity under personal account and no company settings', () => {
  const staff = {
    roleId: 'staff',
    permissions: { relationships: true, properties: true, schedule: true },
  };
  const groups = connectedGroups(staff);
  assert.deepEqual(
    groups.map((group) => group.key),
    ['overview', 'relationships', 'inventory', 'work', 'resources', 'personal'],
  );
  assert.deepEqual(itemsOf(groups, 'personal'), ['My profile', 'Team activity']);
  assert.equal(navLabel(staff, 'Team activity'), 'My activity');
  assert.equal(navLabel({ roleId: 'admin' }, 'Team activity'), 'Team activity');
  assert.ok(!names(groups).includes('Channels'));
});

test('the Super Admin keeps one administration group and no company conversations', () => {
  const owner = { roleId: 'super-admin', permissions: full };
  const groups = connectedGroups(owner);
  assert.deepEqual(itemsOf(groups, 'platform'), ['Workspaces', 'Marketplace applications']);
  assert.deepEqual(itemsOf(groups, 'company'), ['Team & access', 'Team activity']);
  assert.equal(names(groups).filter((name) => name === 'Workspaces').length, 1);
  assert.ok(names(groups).includes('Messages'));
  for (const name of ['Inbox', 'Team chat', 'Agreements', 'Marketplace'])
    assert.ok(!names(groups).includes(name), name);
  assert.equal(navLabel(owner, 'Team activity'), 'Team activity');
});
