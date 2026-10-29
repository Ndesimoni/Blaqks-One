import assert from 'node:assert/strict';
import test from 'node:test';
import {
  websiteAccess,
  websiteForm,
  websitePayload,
  websiteStatus,
} from '../../src/features/server/website/websiteModel.js';

const site = {
  version: 6,
  name: 'Published company',
  host: 'verified.company.test',
  theme: '4',
  active: false,
  entitled: true,
  licenceVerified: false,
  company: { mark: 'PC', area: 'Dubai', note: 'Public introduction', landlord: 'PRIVATE' },
  content: { heroTitle: 'Published headline', providerToken: 'PRIVATE' },
  sessionToken: 'PRIVATE',
};

test('editing a company projects public fields and preserves hidden state without domain or eligibility authority', () => {
  const form = websiteForm(site, false);
  const payload = websitePayload(form, false);
  assert.equal(payload.active, false);
  assert.equal(payload.version, site.version);
  assert.equal(payload.theme, '4');
  assert.equal(payload.company.mark, 'PC');
  assert.equal(payload.content.heroTitle, 'Published headline');
  assert.ok(!JSON.stringify(payload).includes('PRIVATE'));
  for (const field of ['host', 'slug', 'entitled', 'licenceVerified', 'sessionToken'])
    assert.ok(!Object.hasOwn(payload, field), field);
});

test('a persisted draft keeps its source site version until explicit recovery, even after newer publication', () => {
  const draft = { ...site, version: 4, content: { heroTitle: 'Private draft headline' } };
  const payload = websitePayload(websiteForm(site, false, draft), false);
  assert.equal(payload.version, 4);
  assert.equal(payload.content.heroTitle, 'Private draft headline');
  assert.notEqual(payload.version, site.version);
});

test('platform editing includes the chosen hostname without copying company fields or provider settings', () => {
  const form = websiteForm({ ...site, host: 'BLAQKS.TEST' }, true);
  const payload = websitePayload(form, true);
  assert.equal(payload.host, 'blaqks.test');
  assert.ok(!Object.hasOwn(payload, 'company'));
  assert.ok(!Object.hasOwn(payload, 'entitled'));
  assert.ok(!JSON.stringify(payload).includes('PRIVATE'));
});

test('site visibility follows activation and entitlement independently of listing licence eligibility', () => {
  assert.equal(websiteStatus(null, false), 'notPublished');
  assert.equal(websiteStatus(site, false), 'hidden');
  const active = { ...site, active: true };
  assert.equal(websiteStatus(active, false), 'published');
  assert.equal(websiteStatus({ ...active, entitled: false }, false), 'setupRequired');
  assert.equal(websiteStatus({ ...active, entitled: false }, true), 'published');
});

test('company controls require their own live Admin scope while platform controls remain globally scoped', () => {
  const owner = { id: 'company-a', status: 'active' };
  const admin = { id: 'admin-a', workspaceId: 'company-a', roleId: 'admin' };
  assert.ok(websiteAccess(admin, owner, false));
  assert.ok(!websiteAccess(admin, { ...owner, id: 'company-b' }, false));
  assert.ok(!websiteAccess(admin, { ...owner, status: 'archived' }, false));
  assert.ok(!websiteAccess({ ...admin, roleId: 'staff' }, owner, false));
  assert.ok(!websiteAccess(admin, owner, true));
  assert.ok(websiteAccess({ roleId: 'super-admin' }, { status: 'archived' }, true));
  assert.ok(!websiteAccess({ roleId: 'super-admin' }, owner, false));
});
