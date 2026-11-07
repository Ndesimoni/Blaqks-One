import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { before, test } from 'node:test';
import { patch, workspacePath } from './assignment-helpers.mjs';
import { query } from './helpers.mjs';
import { activate, findMember, invite, memberUpdate, teamPath } from './team-helpers.mjs';
import {
  company,
  ok,
  property,
  publicPath,
  publicRequest,
  publish,
  put,
  setup,
  websitePath,
} from './website-helpers.mjs';

let t;
before(async () => {
  t = await setup('lifecycle');
});
const visible = (site, listing) => publicRequest(publicPath(site, `listings/${listing.id}`));

test('two teams reserve a physical property atomically; eligibility restoration never revives old listings', async () => {
  const third = await activate(
    await invite(t.owner, `web-third-${randomUUID().slice(0, 6)}`, {
      accountRole: 'admin',
      positions: [],
    }),
  );
  const c = await company(t, third, `c-${randomUUID().slice(0, 8)}`);
  const same = { building_project: 'SAME-PRIVATE-TOWER', unit_reference: `SAME-${randomUUID()}` };
  const a = await property(t.admin, same),
    b = await property(t.other, same),
    d = await property(third, same);
  const attempts = await Promise.all([
    publish(t.admin, a, t.profile),
    publish(t.other, b, t.otherProfile),
    publish(third, d, c.profile),
  ]);
  assert.equal(attempts.filter((r) => r.status === 200).length, 2, JSON.stringify(attempts));
  assert.equal(attempts.filter((r) => r.status === 409).length, 1, JSON.stringify(attempts));
  const teams = [
    { session: t.admin, site: t.a, profile: t.profile, record: a },
    { session: t.other, site: t.b, profile: t.otherProfile, record: b },
    { session: third, site: c.site, profile: c.profile, record: d },
  ];
  const winner = attempts.findIndex((r) => r.status === 200),
    loser = attempts.findIndex((r) => r.status === 409);
  const removed = teams[winner],
    replacement = teams[loser],
    old = attempts[winner].value.publication;
  let site = ok(await removed.session.request(websitePath(removed.session))).site;
  site = ok(
    await put(
      t.owner,
      `/platform/websites/companies/${removed.session.user.workspaceId}/eligibility`,
      { version: site.version, licenceVerified: false, entitled: true },
    ),
  ).site;
  assert.equal((await visible(t.platform, old)).status, 404);
  ok(await publish(replacement.session, replacement.record, replacement.profile));
  ok(
    await put(
      t.owner,
      `/platform/websites/companies/${removed.session.user.workspaceId}/eligibility`,
      { version: site.version, licenceVerified: true, entitled: true },
    ),
  );
  assert.equal((await visible(t.platform, old)).status, 404);
  assert.equal(
    (await publish(removed.session, removed.record, removed.profile, { version: old.version + 1 }))
      .status,
    409,
  );
});

test('closing and reopening a source cannot revive a published revision', async () => {
  let record = await property(t.admin);
  const listing = ok(await publish(t.admin, record, t.profile)).publication;
  record = ok(
    await patch(t.admin, 'Properties', record, { ...record.record, listing_status: ' inactive ' }),
  );
  assert.equal((await visible(t.a, listing)).status, 404);
  record = ok(
    await patch(t.admin, 'Properties', record, { ...record.record, listing_status: 'Available' }),
  );
  assert.equal((await visible(t.a, listing)).status, 404);
  assert.ok(
    query(
      `SELECT count(*) FROM publications.crm_website_lifecycle_events WHERE publication='${listing.id}'`,
    ) !== '0',
  );
});

test('per-team limit, staff consent/grant and suspension/reinstatement are enforced', async () => {
  let profile = ok(
    await put(t.one, websitePath(t.one, `/profiles/${t.one.user.id}`), {
      version: 0,
      name: 'Public agent one',
      specialty: 'Homes',
      active: true,
      consent: true,
    }),
  ).profile;
  profile = ok(
    await put(t.admin, websitePath(t.admin, `/profiles/${t.one.user.id}/grant`), {
      version: profile.version,
      canPublish: true,
    }),
  ).profile;
  const same = { building_project: 'TEAM-PRIVATE-TOWER', unit_reference: randomUUID() };
  const first = await property(t.admin, same);
  let second = await property(t.admin, same);
  second = ok(
    await t.admin.request(`${workspacePath(t.admin, 'Properties', second.id)}/assignee`, {
      method: 'PUT',
      body: { version: second.version, assigneeId: t.one.user.id },
    }),
  ).entry;
  ok(await publish(t.admin, first, t.profile));
  const staff = ok(await publish(t.one, second, profile)).publication;
  const third = await property(t.admin, same);
  assert.equal((await publish(t.admin, third, t.profile)).status, 409);
  let member = await findMember(t.admin, t.one.user.id);
  ok(
    await t.admin.request(teamPath(t.admin, member.id), {
      method: 'PATCH',
      body: memberUpdate(member, { active: false }),
    }),
  );
  assert.equal((await visible(t.a, staff)).status, 404);
  member = await findMember(t.admin, member.id);
  ok(
    await t.admin.request(teamPath(t.admin, member.id), {
      method: 'PATCH',
      body: memberUpdate(member, { active: true }),
    }),
  );
  assert.equal((await visible(t.a, staff)).status, 404);
});
