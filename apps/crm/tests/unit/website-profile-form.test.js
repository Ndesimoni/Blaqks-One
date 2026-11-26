import assert from 'node:assert/strict';
import test from 'node:test';
import * as model from '../../src/features/server/website/team/websiteTeamModel.js';

const profile = (member, extra = {}) => ({
  id: `profile-${member}`,
  member,
  body: { name: `Public ${member}`, specialty: 'Marina apartments' },
  consent: true,
  canPublish: false,
  active: true,
  version: 3,
  ...extra,
});

test("an edit for someone else keeps their saved consent; only the member's own form changes it", () => {
  const saved = profile('zed', { consent: false, active: true, version: 7 });
  const form = { ...model.profileForm(saved), consent: true, specialty: '  Villas  ' };
  const others = model.profileBody(form, saved);
  assert.equal(others.consent, false);
  assert.equal(others.version, 7);
  assert.equal(others.specialty, 'Villas');
  assert.equal(others.active, true);
  assert.equal(model.profileBody(form, saved, { self: true }).consent, true);
  const agreed = profile('amy', { consent: true });
  const off = { ...model.profileForm(agreed), consent: false };
  assert.equal(model.profileBody(off, agreed).consent, true);
  assert.equal(model.profileBody(off, agreed, { active: false }).active, false);
  assert.equal(model.profileBody(off, agreed, { self: true }).consent, false);
});

test('a new profile starts at version 0, from the account name, without blank contacts', () => {
  const form = model.profileForm(null, 'Synthetic Account Name');
  assert.equal(form.name, 'Synthetic Account Name');
  assert.equal(form.consent, false);
  const body = model.profileBody({ ...form, specialty: 'Offices' }, null);
  assert.deepEqual(body, {
    version: 0,
    name: 'Synthetic Account Name',
    specialty: 'Offices',
    consent: false,
    active: true,
  });
  const typed = { ...form, publicWhatsApp: ' +971501234567 ', publicEmail: 'agent@company.ae' };
  const contacts = model.profileBody(typed, null, { self: true });
  assert.equal(contacts.publicWhatsApp, '+971501234567');
  assert.equal(contacts.publicEmail, 'agent@company.ae');
  // Only the member chooses public contacts: someone else's edit sends the saved ones.
  assert.equal(model.profileBody(typed, null).publicWhatsApp, undefined);
  assert.equal(model.formChanged({ ...form, name: ' Synthetic Account Name ' }, form), false);
  assert.equal(model.formChanged({ ...form, consent: true }, form), true);
});

test('validation mirrors the server limits for names, specialties and public contacts', () => {
  const valid = { name: 'Agent', specialty: 'Villas', publicWhatsApp: '', publicEmail: '' };
  assert.deepEqual(model.profileErrors(valid), {});
  const errors = model.profileErrors({
    name: 'x'.repeat(101),
    specialty: '<b>Villas</b>',
    publicWhatsApp: '0501234567',
    publicEmail: 'agent@localhost',
  });
  assert.deepEqual(Object.keys(errors).sort(), [
    'name',
    'publicEmail',
    'publicWhatsApp',
    'specialty',
  ]);
  assert.equal(model.profileErrors({ ...valid, name: '   ' }).name, 'error.name');
  assert.equal(
    model.profileErrors({ ...valid, specialty: 'x'.repeat(201) }).specialty,
    'error.specialty',
  );
  assert.deepEqual(model.profileErrors({ ...valid, name: 'x'.repeat(100) }), {});
  assert.equal(
    model.profileErrors({ ...valid, publicWhatsApp: '+9715' }).publicWhatsApp,
    'error.whatsApp',
  );
  assert.equal(
    model.profileErrors({ ...valid, publicEmail: 'a b@c.ae' }).publicEmail,
    'error.email',
  );
  assert.deepEqual(model.profileErrors({ ...valid, publicEmail: 'agent@company.ae' }), {});
});

test('refused saves map stale versions, a missing website and lost access to their texts', () => {
  const failure = (status, code) => ({ status, details: { code } });
  assert.equal(model.profileFailure(failure(409, 'version_conflict')), 'stale');
  assert.equal(model.profileFailure(failure(409, 'conflict')), 'noSite');
  assert.equal(model.profileFailure(failure(404, 'not_found')), 'noAccess');
  assert.equal(model.profileFailure(failure(403, 'forbidden')), '');
});

test('an edit of another member keeps their saved public contacts', () => {
  const saved = profile('amy', {
    consent: true,
    body: {
      name: 'Amy',
      specialty: 'Homes',
      publicWhatsApp: '+971500000001',
      publicEmail: 'a@b.ae',
    },
  });
  const form = { ...model.profileForm(saved), publicEmail: 'private@b.ae', specialty: 'Villas' };
  const body = model.profileBody(form, saved);
  assert.deepEqual(
    [body.publicWhatsApp, body.publicEmail, body.specialty],
    ['+971500000001', 'a@b.ae', 'Villas'],
  );
});

test("the member's own save sends their canonical links; anyone else's leaves them out", () => {
  const links = { instagram: 'https://instagram.com/amy', website: 'https://amy-homes.ae/' };
  const saved = profile('amy', { body: { name: 'Amy', specialty: 'Homes', social: links } });
  const form = model.profileForm(saved);
  assert.equal(form.social.instagram, links.instagram);
  assert.equal(model.formChanged(form, model.profileForm(saved)), false);
  const typed = { ...form, social: { ...form.social, x: ' x.com/amy ', website: '' } };
  assert.equal(model.formChanged(typed, form), true);
  assert.deepEqual(model.profileBody(typed, saved, { self: true }).social, {
    instagram: links.instagram,
    x: 'https://x.com/amy',
  });
  // Someone else's edit, Hide or Show omits links so the server keeps the member's own.
  assert.equal(Object.hasOwn(model.profileBody(typed, saved), 'social'), false);
  assert.equal(Object.hasOwn(model.profileBody(form, saved, { active: false }), 'social'), false);
  // Clearing every link on one's own save sends none, which removes them.
  const cleared = { ...form, social: model.profileForm(null).social };
  assert.equal(Object.hasOwn(model.profileBody(cleared, saved, { self: true }), 'social'), false);
});

test('link problems join the profile errors and are focused after the details', () => {
  const form = { ...model.profileForm(null, 'Agent'), specialty: 'Villas' };
  form.social = { ...form.social, tiktok: 'https://tiktok.com.evil.ae/@k' };
  assert.deepEqual(model.profileErrors(form), { tiktok: 'tiktokInvalid' });
  assert.equal(model.firstInvalid(model.profileErrors(form)), 'tiktok');
  assert.equal(model.firstInvalid(model.profileErrors({ ...form, name: '' })), 'name');
});
