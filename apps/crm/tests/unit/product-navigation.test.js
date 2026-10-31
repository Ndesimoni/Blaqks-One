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

test('every destination of the grouped sidebar has exactly one place among the products', () => {
  for (const user of [admin, staff, superAdmin]) {
    const routes = placed(user);
    assert.equal(new Set(routes).size, routes.length, `${user.roleId} has a duplicate`);
    assert.deepEqual([...new Set(routes)].sort(), [...new Set(grouped(user))].sort(), user.roleId);
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
});

test('a product reopens on its remembered route only while that route is still allowed', () => {
  assert.equal(productEntry(admin, 'crm', 'Viewings'), 'Viewings');
  assert.equal(productEntry(admin, 'crm', 'Team chat'), 'Dashboard');
  assert.equal(productEntry(admin, 'crm'), 'Dashboard');
  assert.equal(productEntry(staff, 'crm', 'Deals'), 'Dashboard');
  assert.equal(productEntry(admin, 'unknown'), null);
});
