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

test('20 CRM sections, eight account, workspace and platform screens and the connected-only pages have unique stable routes and safe external links', () => {
  assert.equal(crmRoutes.length, 20);
  assert.equal(settingsRoutes.length, 8);
  // The start page (NAV1b) is one more connected-only page; the website sections (NAV) are four;
  // My profile's Website profile and Sign-in and security tabs and Settings → Company are three
  // more, the Marketplace's My requests, Updates and Broker profile three more, and Messages'
  // Marketplace chats one more. Blaqks One's dashboard (BO1d) and team (BO1b) sit with settings.
  assert.equal(routes.length, 50);
  assert.equal(new Set(routes.map((route) => route.path)).size, 50);
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
  assert.equal(routePath('Website profile'), '/website-profile');
  assert.equal(routePath('Company'), '/company');
  assert.equal(routePath('My requests'), '/my-requests');
  assert.equal(routePath('Sign-in and security'), '/sign-in-security');
  for (const route of routes) assert.equal(routeName(routePath(route.name)), route.name);
  assert.equal(routeName('/unknown'), 'Page not found');
  assert.equal(safeExternalUrl('javascript:alert(1)'), '');
  assert.equal(safeExternalUrl('data:text/html,test'), '');
  assert.equal(safeExternalUrl('https://example.com/tour'), 'https://example.com/tour');
});
