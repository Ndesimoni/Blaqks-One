import test from 'node:test';
import assert from 'node:assert/strict';
import { nav } from '../../src/config/navigation.js';
import { canOpenSection } from '../../src/features/server/access.js';
import { isConnectedSection } from '../../src/features/server/sectionStatus.js';

const modules = ['relationships', 'properties', 'schedule', 'finance', 'reports', 'exports'];
const full = Object.fromEntries(modules.map((name) => [name, true]));

test('Admins can reach the familiar sections while only implemented screens are live', () => {
  for (const roleId of ['admin', 'super-admin']) {
    const user = { roleId, permissions: full };
    for (const { items } of nav) {
      for (const [name] of items) assert.equal(canOpenSection(user, name), true, name);
    }
    for (const name of ['My profile', 'Team & access', 'Workspaces', 'Team activity'])
      assert.equal(canOpenSection(user, name), true);
  }
  for (const name of [
    'Leads',
    'Clients',
    'Contacts',
    'Properties',
    'Follow-ups',
    'Viewings',
    'Shortlist',
    'Interaction log',
    'Client care',
    'Team & access',
    'Dashboard',
    'Client desk',
    'Deals',
    'Payments',
    'Expenses',
    'Performance',
    'CRM insights',
  ])
    assert.equal(isConnectedSection(name), true, name);
  for (const name of ['Messages', 'Date search', 'My profile', 'Workspaces', 'Anything'])
    assert.equal(isConnectedSection(name), false, name);
});

test('future navigation respects staff module and messaging grants without exposing team authority', () => {
  const staff = { roleId: 'staff', permissions: { finance: true } };
  for (const name of ['Deals', 'Payments', 'Expenses', 'Dashboard', 'Guide', 'My profile'])
    assert.equal(canOpenSection(staff, name), true, name);
  for (const name of [
    'Clients',
    'Leads',
    'Properties',
    'Follow-ups',
    'Performance',
    'Messages',
    'Workspaces',
    'Team activity',
    'Team & access',
  ])
    assert.equal(canOpenSection(staff, name), false, name);
  for (const channel of ['email', 'whatsapp'])
    assert.equal(
      canOpenSection({ ...staff, channelAccess: { [channel]: true } }, 'Messages'),
      true,
    );
  assert.equal(
    canOpenSection({ roleId: 'staff', permissions: { relationships: true } }, 'Leads'),
    true,
  );
  assert.equal(
    canOpenSection({ roleId: 'staff', permissions: { schedule: true } }, 'Viewings'),
    true,
  );
  assert.equal(
    canOpenSection({ roleId: 'staff', permissions: { reports: true } }, 'Performance'),
    true,
  );
});

test('unknown identities, routes and missing grants fail closed', () => {
  for (const user of [null, {}, { roleId: 'owner', permissions: full }]) {
    for (const route of ['Clients', 'Dashboard', 'Team & access'])
      assert.equal(canOpenSection(user, route), false);
  }
  assert.equal(canOpenSection({ roleId: 'staff' }, 'Clients'), false);
  assert.equal(canOpenSection({ roleId: 'super-admin', permissions: full }, 'Not a screen'), false);
});
