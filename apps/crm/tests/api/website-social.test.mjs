import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { ok, publicPath, publicRequest, put, setup, websitePath } from './website-helpers.mjs';

let t;
before(async () => {
  t = await setup('social');
});
const social = {
  instagram: 'https://instagram.com/synthetic.company',
  linkedin: 'https://www.linkedin.com/company/synthetic',
  website: 'https://www.synthetic-company.ae/',
};
const site = async () => ok(await t.admin.request(websitePath(t.admin))).site;
const saveSite = async (links) => {
  const live = await site();
  const body = { version: live.version, name: live.name, theme: live.theme };
  return put(t.admin, websitePath(t.admin), {
    ...body,
    content: { ...live.content, social: links },
  });
};

test('company social links publish with the site and appear in its public content', async () => {
  ok(await saveSite(social));
  const resolved = ok(await publicRequest(`sites/resolve?host=${t.a.host}`)).data;
  assert.deepEqual(resolved.content.social, social);
});

test('links outside each network, plain http and scripts are refused', async () => {
  for (const links of [
    { instagram: 'https://instagram.com.evil.example/k' },
    { facebook: 'https://instagram.com/k' },
    { tiktok: 'http://tiktok.com/@k' },
    { website: 'javascript:alert(1)' },
    { website: 'https://127.0.0.1/' },
    { myspace: 'https://myspace.com/k' },
    { instagram: '' },
    { website: 'https://bit.ly/abc' },
    { facebook: 'https://facebook.com/l.php?u=https%3A%2F%2Fevil.ae' },
    { instagram: 'https://INSTAGRAM.com/k' },
  ]) {
    assert.equal((await saveSite(links)).status, 400, JSON.stringify(links));
  }
});

test('a member publishes their own links; an Admin edit cannot change them', async () => {
  const path = websitePath(t.admin, `/profiles/${t.one.user.id}`);
  const base = { name: 'Agent one', specialty: 'Homes', active: true, consent: true };
  const mine = ok(
    await put(t.one, path, { ...base, version: 0, social: { tiktok: 'https://tiktok.com/@one' } }),
  ).profile;
  assert.deepEqual(mine.body.social, { tiktok: 'https://tiktok.com/@one' });
  const edit = { ...base, version: mine.version, specialty: 'Villas' };
  assert.equal((await put(t.admin, path, { ...edit, social: {} })).status, 403);
  const changed = { tiktok: 'https://tiktok.com/@other' };
  assert.equal((await put(t.admin, path, { ...edit, social: changed })).status, 403);
  const kept = ok(await put(t.admin, path, { ...edit, social: mine.body.social })).profile;
  assert.equal(kept.body.specialty, 'Villas');
  // An Admin edit that leaves links out keeps the member's own links.
  const named = ok(await put(t.admin, path, { ...edit, version: kept.version, name: 'One' }));
  assert.deepEqual(named.profile.body.social, { tiktok: 'https://tiktok.com/@one' });
});

test('the Admin public profile carries their links on the website', async () => {
  const path = websitePath(t.admin, `/profiles/${t.admin.user.id}`);
  const own = ok(await t.admin.request(path)).profile;
  const body = { ...own.body, version: own.version, consent: true, active: true };
  delete body.id;
  delete body.company;
  const links = { youtube: 'https://youtube.com/@synthetic', website: 'https://www.agent.ae/' };
  ok(await put(t.admin, path, { ...body, social: links }));
  const agent = ok(await publicRequest(publicPath(t.a, `agents/${own.id}`))).data;
  assert.deepEqual(agent.social, links);
  // A member's own website appears on their company site only, never the general site.
  const general = ok(await publicRequest(publicPath(t.platform, `agents/${own.id}`))).data;
  assert.deepEqual(general.social, { youtube: links.youtube });
});
