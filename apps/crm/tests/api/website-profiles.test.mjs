import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { ok, property, publish, put, setup, websitePath } from './website-helpers.mjs';

let t;
before(async () => {
  t = await setup('profiles');
});
const own = (body) => put(t.one, websitePath(t.admin, `/profiles/${t.one.user.id}`), body);
const byAdmin = (body) => put(t.admin, websitePath(t.admin, `/profiles/${t.one.user.id}`), body);
const fields = { name: 'Agent one', specialty: 'Homes', active: true };

test('an Admin edit keeps the member consent and cannot change it either way', async () => {
  let profile = ok(await own({ ...fields, version: 0, consent: true })).profile;
  const edit = { ...fields, specialty: 'Villas', version: profile.version };
  assert.equal((await byAdmin({ ...edit, consent: false })).status, 403);
  profile = ok(await byAdmin({ ...edit, consent: true })).profile;
  assert.equal(profile.consent, true);
  assert.equal(profile.body.specialty, 'Villas');
  // Hiding stays an Admin choice; consent remains the member's own.
  profile = ok(
    await byAdmin({ ...edit, version: profile.version, active: false, consent: true }),
  ).profile;
  assert.deepEqual([profile.active, profile.consent], [false, true]);
});

test('staff cannot undo a Hide and an Admin cannot change their public contacts', async () => {
  const path = websitePath(t.admin, `/profiles/${t.one.user.id}`);
  const hidden = ok(await t.admin.request(path)).profile;
  const body = { ...fields, version: hidden.version, consent: true };
  assert.equal((await own({ ...body, active: true })).status, 403);
  const mine = ok(await own({ ...body, active: false, publicEmail: 'one@public.example' })).profile;
  const edit = { ...fields, version: mine.version, consent: true, active: false };
  assert.equal((await byAdmin({ ...edit, publicEmail: 'private@one.example' })).status, 403);
  assert.equal((await byAdmin(edit)).status, 403);
  const kept = { ...edit, publicEmail: 'one@public.example', specialty: 'Offices' };
  assert.equal(ok(await byAdmin(kept)).profile.body.specialty, 'Offices');
});

test('only the owning Admin lists the company profiles', async () => {
  const { profiles } = ok(await t.admin.request(websitePath(t.admin, '/profiles')));
  const members = profiles.map((profile) => profile.member).sort();
  assert.deepEqual(members, [t.admin.user.id, t.one.user.id].sort());
  assert.ok(profiles.every((profile) => profile.workspace === t.admin.user.workspaceId));
  for (const session of [t.one, t.other]) {
    assert.equal((await session.request(websitePath(t.admin, '/profiles'))).status, 403);
  }
});

test('the private listing list says where and when each listing was published', async () => {
  const entry = await property(t.admin);
  ok(await publish(t.admin, entry, t.profile));
  const { publications } = ok(await t.admin.request(websitePath(t.admin, '/listings')));
  const listed = publications.find((row) => row.recordId === entry.id);
  assert.equal(listed.destination, 'general_and_company');
  assert.match(listed.publishedAt, /^\d{4}-\d{2}-\d{2} /);
});
