import test from 'node:test';
import assert from 'node:assert/strict';
import { createItems } from '../../src/features/server/products/createModel.js';
import { OWN_HEADING, pageTitle } from '../../src/features/server/products/pageTitle.js';

const words = {
  'start.home': 'Home',
  'inbox.title': 'Inbox',
  'websites.title': 'Website',
  'websites.platformTitle': 'Platform website',
};
const t = (key) => words[key] ?? key;
const admin = { roleId: 'admin' };

test('Create lists the CRM records a person may create, a lead first, and nothing elsewhere', () => {
  const all = createItems('crm', () => true);
  assert.deepEqual(
    all.map((item) => item.key),
    ['lead', 'client', 'contact', 'property', 'followUp', 'viewing'],
  );
  assert.equal(all[0].module, 'Clients');
  assert.equal(all[0].defaults().lead_stage, 'New');
  assert.match(all[0].defaults().date_added, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(all[1].defaults, undefined);
  const noClients = createItems(
    'crm',
    (module, action) => action === 'create' && module !== 'Clients',
  );
  assert.deepEqual(
    noClients.map((item) => item.key),
    ['contact', 'property', 'followUp', 'viewing'],
  );
  assert.deepEqual(
    createItems('crm', () => false),
    [],
  );
  for (const product of ['web', 'market', 'messages', 'platform', 'settings', undefined])
    assert.deepEqual(
      createItems(product, () => true),
      [],
    );
});

test('the top bar keeps the names the page headings used', () => {
  assert.equal(pageTitle('Dashboard', admin, t), 'Overview');
  assert.equal(pageTitle('Deals', admin, t), 'Deals & commissions');
  assert.equal(pageTitle('Payments', admin, t), 'Commission receipts');
  assert.equal(pageTitle('Client desk', admin, t), 'Client search & matching');
  assert.equal(pageTitle('Team & access', admin, t), 'Team');
  assert.equal(pageTitle('My profile', admin, t), 'My profile');
  assert.equal(pageTitle('Website', admin, t), 'Website');
  assert.equal(pageTitle('Platform website', admin, t), 'Platform website');
  assert.equal(pageTitle('Start', admin, t), 'Home');
});

test('pages with a main heading of their own are named in the top bar without one', () => {
  assert.deepEqual(OWN_HEADING, ['Start', 'Inbox', 'Team chat']);
  assert.equal(pageTitle('Inbox', admin, t), 'Inbox');
});
