import test from 'node:test';
import assert from 'node:assert/strict';
import { routePermissions } from '../../src/config/team.js';
import { routePath } from '../../src/config/routes.js';
import { canOpenSection } from '../../src/features/server/access.js';
import { locate } from '../../src/features/server/products/productModel.js';
import { WEBSITE_ROUTES } from '../../src/features/server/website/websiteRoutes.js';

const clients = { [routePermissions.Clients]: true };
const admin = { roleId: 'admin', permissions: clients };
const adminWithoutClients = { roleId: 'admin', permissions: {} };
const staff = { roleId: 'staff', permissions: clients };
const superAdmin = { roleId: 'super-admin', permissions: clients };
const company = ['Website', 'Website team', 'Website properties', 'Website enquiries'];
const platform = ['Platform website', 'Platform companies'];

test('company website sections open for the Admin only; Enquiries also needs Clients', () => {
  for (const route of company) assert.equal(canOpenSection(admin, route), true, route);
  assert.deepEqual(
    company.map((route) => canOpenSection(adminWithoutClients, route)),
    [true, true, true, false],
  );
  for (const route of company) {
    assert.equal(canOpenSection(staff, route), false, route);
    assert.equal(canOpenSection(superAdmin, route), false, route);
  }
});

test('the platform website and its Companies tab open for the Super Admin only', () => {
  for (const route of platform) {
    assert.equal(canOpenSection(superAdmin, route), true, route);
    assert.equal(canOpenSection(admin, route), false, route);
    assert.equal(canOpenSection(staff, route), false, route);
  }
});

test('every website route has its own address and a place in its product', () => {
  assert.deepEqual(Object.keys(WEBSITE_ROUTES).sort(), [...company, ...platform].sort());
  const paths = Object.keys(WEBSITE_ROUTES).map(routePath);
  assert.equal(new Set(paths).size, paths.length);
  assert.ok(paths.every((path) => path !== '/'));
  assert.deepEqual(
    company.map((route) => [locate(admin, route)?.product, locate(admin, route)?.section.key]),
    [
      ['web', 'websiteContent'],
      ['web', 'websiteTeam'],
      ['web', 'websiteListings'],
      ['web', 'websiteEnquiries'],
    ],
  );
  const tabs = locate(superAdmin, 'Platform companies')?.section;
  assert.deepEqual(tabs?.routes, ['Platform website', 'Platform companies']);
});
