import assert from 'node:assert/strict';
import test from 'node:test';
import { routeName, routePath } from '../../src/config/routes.js';
import { canOpenSection } from '../../src/features/server/access.js';
import { hasPlatformArea } from '../../src/features/server/platformAccess.js';
import {
  readClientDetail,
  readClientList,
  readOwners,
} from '../../src/features/server/platformClients/clientShapes.js';
import { pageTitle } from '../../src/features/server/products/pageTitle.js';
import { locate, productEntry } from '../../src/features/server/products/productModel.js';
import { isConnectedSection } from '../../src/features/server/sectionStatus.js';
import { createI18n } from '../../src/i18n/createI18n.js';

const { t } = createI18n('en', { env: {} });
const client = {
  id: 'c-1',
  companyName: 'Palm Realty',
  contactName: 'Sara Khan',
  phone: '+971501234567',
  email: 'sara@palm.test',
  source: 'website_form',
  stage: 'new',
  nextFollowUp: null,
  ownerId: null,
  ownerName: null,
  linkedCompany: null,
  updatedAt: '2026-11-05T10:00:00Z',
  version: 1,
};

test('the list is read only when complete; counts and cursor have safe defaults', () => {
  const page = readClientList({ clients: [client], stageCounts: { new: 1 }, nextCursor: 'n2' });
  assert.equal(page.clients[0].companyName, 'Palm Realty');
  assert.equal(page.clients[0].ownerName, '');
  assert.equal(page.clients[0].linkedCompany, null);
  assert.equal(page.stageCounts.new, 1);
  assert.equal(page.stageCounts.lost, 0);
  assert.equal(page.nextCursor, 'n2');
  assert.equal(readClientList({ clients: [] }).nextCursor, null);
  for (const broken of [
    {},
    { clients: [{ ...client, id: '' }] },
    { clients: [{ ...client, stage: 'won' }] },
    { clients: [{ ...client, version: '1' }] },
    { clients: [{ ...client, linkedCompany: 'Palm' }] },
  ])
    assert.throws(() => readClientList(broken), /incomplete/);
  const unknown = readClientList({ clients: [{ ...client, source: 'billboard' }] });
  assert.equal(unknown.clients[0].source, 'other');
  const linked = { ...client, linkedCompany: { id: 'co-1', name: 'Palm Realty LLC' } };
  assert.deepEqual(readClientList({ clients: [linked] }).clients[0].linkedCompany, {
    id: 'co-1',
    name: 'Palm Realty LLC',
  });
});

test('a client opens with its timeline newest first; an unknown kind reads as a note', () => {
  const detail = readClientDetail({
    client: { ...client, notes: 'Team of 12', createdByName: 'Owner' },
    timeline: [
      { id: 'e1', kind: 'created', body: null, authorName: 'Owner', at: '2026-11-01T09:00:00Z' },
      { id: 'e3', kind: 'fax', body: 'Odd', authorName: 'Sam', at: '2026-11-04T09:00:00Z' },
      { id: 'e2', kind: 'call', body: 'Booked', authorName: 'Sam', at: '2026-11-03T09:00:00Z' },
    ],
  });
  assert.equal(detail.client.notes, 'Team of 12');
  assert.deepEqual(
    detail.timeline.map((entry) => entry.id),
    ['e3', 'e2', 'e1'],
  );
  assert.equal(detail.timeline[0].kind, 'note');
  assert.equal(detail.timeline[2].body, '');
  assert.throws(() => readClientDetail({ client }), /incomplete/);
  assert.deepEqual(readOwners({ owners: [{ id: 'u1', name: 'Sam' }] }), [
    { id: 'u1', name: 'Sam' },
  ]);
  assert.throws(() => readOwners({}), /incomplete/);
});

test('Platform → Clients opens with the clients area; company people never see it', () => {
  assert.equal(routePath('Blaqks One clients'), '/platform-clients');
  assert.equal(routeName('/platform-clients'), 'Blaqks One clients');
  const owner = { roleId: 'super-admin' };
  const sales = { roleId: 'platform', platformAccess: { clients: 'manage', companies: 'view' } };
  const viewer = { roleId: 'platform', platformAccess: { clients: 'view' } };
  const analyst = { roleId: 'platform', platformAccess: { dashboard: 'view' } };
  for (const user of [owner, sales, viewer])
    assert.equal(canOpenSection(user, 'Blaqks One clients'), true, user.roleId);
  assert.equal(hasPlatformArea(viewer, 'clients', 'manage'), false);
  assert.equal(hasPlatformArea(sales, 'clients', 'manage'), true);
  const all = { relationships: true, properties: true, schedule: true, finance: true };
  for (const user of [analyst, { roleId: 'admin', permissions: all }, { roleId: 'staff' }, null])
    assert.equal(canOpenSection(user, 'Blaqks One clients'), false);
  assert.equal(isConnectedSection('Blaqks One clients', owner), true);
  const place = locate(owner, 'Blaqks One clients');
  assert.equal(place.product, 'platform');
  assert.equal(t(`products.sections.${place.section.key}`), 'Clients');
  // Sales opens Platform on its clients; the Owner still on the dashboard.
  assert.equal(productEntry(sales, 'platform'), 'Blaqks One clients');
  assert.equal(productEntry(owner, 'platform'), 'Platform dashboard');
  assert.equal(pageTitle('Blaqks One clients', owner, t), 'Clients');
});
