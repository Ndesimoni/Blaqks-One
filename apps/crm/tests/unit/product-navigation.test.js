import test from 'node:test';
import assert from 'node:assert/strict';
import { connectedGroups } from '../../src/features/server/connectedNav.js';
import {
  locate,
  productEntry,
  productSections,
  visibleProducts,
} from '../../src/features/server/products/productModel.js';

const all = { relationships: true, properties: true, schedule: true, finance: true };
const admin = { roleId: 'admin', managesTeam: true, permissions: { ...all, reports: true } };
const staff = { roleId: 'staff', permissions: { relationships: true, schedule: true } };
const superAdmin = { roleId: 'super-admin', managesTeam: true, permissions: all };

const placed = (user) =>
  visibleProducts(user).flatMap((product) =>
    productSections(user, product.key).flatMap((section) => section.routes),
  );
const grouped = (user) => connectedGroups(user).flatMap((group) => group.items);

// The website sections replaced the Website pages' in-page tabs, and My profile's other tabs
// are header tabs only, so only products list them.
const formerTabs = [
  'Website team',
  'Website properties',
  'Website enquiries',
  'Platform companies',
  'Website profile',
  'Sign-in and security',
];

test('every destination of the grouped sidebar has exactly one place among the products', () => {
  for (const user of [admin, staff, superAdmin]) {
    const routes = placed(user);
    assert.equal(new Set(routes).size, routes.length, `${user.roleId} has a duplicate`);
    assert.deepEqual(
      routes.filter((route) => !formerTabs.includes(route)).sort(),
      [...new Set(grouped(user))].sort(),
      user.roleId,
    );
  }
});

test('products follow permissions: Websites for the Admin, Platform for the Super Admin', () => {
  const keys = (user) => visibleProducts(user).map((product) => product.key);
  assert.deepEqual(keys(admin), ['crm', 'web', 'market', 'messages', 'settings']);
  assert.equal(keys(superAdmin).includes('platform'), true);
  assert.equal(keys(superAdmin).includes('web'), false);
  assert.equal(keys(staff).includes('web'), false);
});

test('a route is found in its product and section, and sections keep their header tabs', () => {
  assert.deepEqual(locate(admin, 'Payments').section.routes, ['Deals', 'Payments', 'Expenses']);
  assert.equal(locate(admin, 'Client desk').section.key, 'clients');
  assert.equal(locate(admin, 'Team activity').section.key, 'activity');
  assert.equal(locate(staff, 'Team activity').section.key, 'myActivity');
  assert.equal(locate(admin, 'Workspaces').product, 'settings');
  assert.equal(locate(superAdmin, 'Workspaces').product, 'platform');
  assert.equal(locate(admin, 'Page not found'), null);
  // My profile's tabs: a website profile only for agents (the Admin, staff with Properties).
  const profileTabs = ['My profile', 'Website profile', 'Sign-in and security'];
  assert.deepEqual(locate(admin, 'Website profile').section.routes, profileTabs);
  assert.equal(locate(staff, 'Website profile'), null);
  assert.deepEqual(locate(staff, 'My profile').section.routes, [
    'My profile',
    'Sign-in and security',
  ]);
});

test('a product reopens on its remembered route only while that route is still allowed', () => {
  assert.equal(productEntry(admin, 'crm', 'Viewings'), 'Viewings');
  assert.equal(productEntry(admin, 'crm', 'Team chat'), 'Dashboard');
  assert.equal(productEntry(admin, 'crm'), 'Dashboard');
  assert.equal(productEntry(staff, 'crm', 'Deals'), 'Dashboard');
  assert.equal(productEntry(admin, 'unknown'), null);
});

test('the start page greets by the time of day and the first name', async () => {
  const { firstName, greetingKey } =
    await import('../../src/features/server/products/startModel.js');
  assert.equal(greetingKey(8), 'start.morning');
  assert.equal(greetingKey(12), 'start.afternoon');
  assert.equal(greetingKey(18), 'start.evening');
  assert.equal(firstName('  Aidah  Simoni '), 'Aidah');
  assert.equal(firstName(''), '');
});
