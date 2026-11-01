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
  // The start page (NAV1b) is one more connected-only page; the website sections (NAV) are four.
  assert.equal(routes.length, 41);
  assert.equal(new Set(routes.map((route) => route.path)).size, 41);
  assert.equal(routePath('Start'), '/start');
  assert.equal(routePath('Messages'), '/messages');
  assert.equal(
    routes.some((route) => route.name === 'Calendar'),
    false,
  );
  assert.equal(routePath('Leads'), '/leads');
  assert.equal(routePath('Website'), '/website');
  assert.equal(routePath('Platform website'), '/platform-website');
  assert.equal(routePath('Website team'), '/website-team');
  assert.equal(routePath('Website properties'), '/website-properties');
  assert.equal(routePath('Website enquiries'), '/website-enquiries');
  assert.equal(routePath('Platform companies'), '/platform-companies');
  for (const route of routes) assert.equal(routeName(routePath(route.name)), route.name);
  assert.equal(routeName('/unknown'), 'Page not found');
  assert.equal(safeExternalUrl('javascript:alert(1)'), '');
  assert.equal(safeExternalUrl('data:text/html,test'), '');
  assert.equal(safeExternalUrl('https://example.com/tour'), 'https://example.com/tour');
});
