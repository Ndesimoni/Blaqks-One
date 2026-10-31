import assert from 'node:assert/strict';
import test from 'node:test';
import {
  crmRoutes,
  routeName,
  routePath,
  routes,
  settingsRoutes,
} from '../../src/config/routes.js';
import { safeExternalUrl } from '../../src/lib/validation.js';

test('20 CRM sections, six account/workspace screens and the connected-only pages have unique stable routes and safe external links', () => {
  assert.equal(crmRoutes.length, 20);
  assert.equal(settingsRoutes.length, 6);
  assert.equal(routes.length, 36);
  assert.equal(new Set(routes.map((route) => route.path)).size, 36);
  assert.equal(routePath('Messages'), '/messages');
  assert.equal(
    routes.some((route) => route.name === 'Calendar'),
    false,
  );
  assert.equal(routePath('Leads'), '/leads');
  assert.equal(routePath('Website'), '/website');
  assert.equal(routePath('Platform website'), '/platform-website');
  for (const route of routes) assert.equal(routeName(routePath(route.name)), route.name);
  assert.equal(routeName('/unknown'), 'Page not found');
  assert.equal(safeExternalUrl('javascript:alert(1)'), '');
  assert.equal(safeExternalUrl('data:text/html,test'), '');
  assert.equal(safeExternalUrl('https://example.com/tour'), 'https://example.com/tour');
});
