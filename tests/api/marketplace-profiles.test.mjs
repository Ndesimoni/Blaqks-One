import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { before, test } from 'node:test';
import { query } from './helpers.mjs';
import { jpegPhoto, pdf, upload } from './media-helpers.mjs';
import { outsideTeams } from './outside-sharing-helpers.mjs';
import { findMember, memberUpdate, teamPath } from './team-helpers.mjs';
import {
  applications,
  approvedCompany,
  bigJpeg,
  currentTerms,
  decide,
  join,
  joinBody,
  market,
  marketTeams,
  photoStatus,
  readProfile,
  switchCompany,
} from './marketplace-helpers.mjs';

// Another company's profile, its photo, the read limits and every reason it hides (MK1b).
let teams;
before(async () => {
  teams = await outsideTeams('market-profiles');
  await approvedCompany(teams.admin, teams.owner);
  await approvedCompany(teams.other, teams.owner);
  await join(teams.one, joinBody(await currentTerms(teams.one)));
  await join(teams.agent, joinBody(await currentTerms(teams.agent)));
});

const member = (session) => session.user.id;

test('a joined member of another approved company reads the profile, never a contact', async () => {
  const result = await readProfile(teams.agent, member(teams.one));
  assert.equal(result.status, 200, JSON.stringify(result.value));
  const profile = result.value.profile;
  assert.equal(profile.name, teams.one.user.name);
  assert.equal(profile.company, teams.admin.user.name);
  assert.deepEqual(profile.communities, ['Dubai Marina', 'JVC']);
  assert.equal(profile.licence.number, '12345');
  assert.equal(profile.licence.authority, 'RERA');
  assert.equal(profile.declared, true);
  assert.equal(profile.email, undefined);
  assert.equal(profile.phone, undefined);
  assert.equal(JSON.stringify(profile).includes('@'), false);
  const hidden = await readProfile(teams.two, member(teams.one));
  assert.equal(hidden.status, 409, JSON.stringify(hidden.value));
});

test('the Super Admin and an unapproved company get the shared not-found', async () => {
  const owner = await teams.owner.request(
    `/workspaces/super-admin-workspace/marketplace/profiles/${member(teams.one)}`,
  );
  assert.equal(owner.status, 404, JSON.stringify(owner.value));
  const stranger = await marketTeams('market-unapproved');
  const fresh = await readProfile(stranger.admin, member(teams.one));
  assert.equal(fresh.status, 404, JSON.stringify(fresh.value));
  assert.equal(JSON.stringify(owner.value), JSON.stringify(fresh.value));
});

test('only a small image becomes the photo, and it serves until the member leaves', async () => {
  const put = (mediaId) => market(teams.one, '/me/photo', { method: 'PUT', body: { mediaId } });
  const document = await upload(teams.one, pdf(), 'permit.pdf');
  assert.equal(document.status, 201);
  const refused = await put(document.value.media.id);
  assert.equal(refused.status, 400, JSON.stringify(refused.value));
  const large = await upload(teams.one, bigJpeg(), 'large.jpg');
  assert.equal(large.status, 201);
  assert.equal((await put(large.value.media.id)).status, 400);
  const photo = await upload(teams.one, jpegPhoto(), 'me.jpg');
  assert.equal(photo.status, 201);
  const attached = await put(photo.value.media.id);
  assert.equal(attached.status, 200, JSON.stringify(attached.value));
  assert.equal(attached.value.status.member.profile.hasPhoto, true);
  assert.equal(await photoStatus(teams.agent, member(teams.one)), 200);
  assert.equal((await readProfile(teams.agent, member(teams.one))).value.profile.hasPhoto, true);
  const removed = await market(teams.one, '/me/photo', { method: 'DELETE' });
  assert.equal(removed.status, 200, JSON.stringify(removed.value));
  assert.equal(await photoStatus(teams.agent, member(teams.one)), 404);
});

test('profile and photo reads are limited per member and per company', async () => {
  const limit = (key, attempts, seconds) => {
    const hash = createHash('sha256').update(key).digest('hex');
    query(
      `INSERT INTO crm_login_limits (key_hash,attempts,window_seconds) VALUES ('${hash}',${attempts},${seconds}) ` +
        `ON CONFLICT (key_hash) DO UPDATE SET attempts=${attempts},window_started=now(),window_seconds=${seconds}`,
    );
    return hash;
  };
  const memberKey = limit(`market-read:${member(teams.agent)}`, 300, 3600);
  const busy = await readProfile(teams.agent, member(teams.one));
  assert.equal(busy.status, 429, JSON.stringify(busy.value));
  assert.match(busy.value.message, /You have read/);
  query(`DELETE FROM crm_login_limits WHERE key_hash='${memberKey}'`);
  const companyKey = limit(`market-read-company:${teams.agent.user.workspaceId}`, 1000, 3600);
  const blocked = await readProfile(teams.agent, member(teams.one));
  assert.equal(blocked.status, 429, JSON.stringify(blocked.value));
  assert.match(blocked.value.message, /Your company/);
  query(`DELETE FROM crm_login_limits WHERE key_hash='${companyKey}'`);
});

test('the profile hides when the member is suspended or the company is off', async () => {
  const status = async (active) => {
    const target = await findMember(teams.admin, member(teams.one));
    return teams.admin.request(teamPath(teams.admin, target.id), {
      method: 'PATCH',
      body: memberUpdate(target, { active }),
    });
  };
  assert.equal((await status(false)).status, 200);
  assert.equal((await readProfile(teams.agent, member(teams.one))).status, 404);
  assert.equal((await status(true)).status, 200);
  assert.equal((await readProfile(teams.agent, member(teams.one))).status, 200);
  const off = await switchCompany(teams.admin, false, 0);
  assert.equal(off.status, 200, JSON.stringify(off.value));
  assert.equal((await readProfile(teams.agent, member(teams.one))).status, 404);
  const on = await switchCompany(teams.admin, true, 1);
  assert.equal(on.status, 200, JSON.stringify(on.value));
  assert.equal((await readProfile(teams.agent, member(teams.one))).status, 200);
});

test('a revoked company hides its members', async () => {
  const queue = await applications(teams.owner, 'all');
  const row = queue.value.applications.find(
    (item) => item.workspaceId === teams.one.user.workspaceId,
  );
  assert.ok(row);
  const revoked = await decide(teams.owner, teams.one.user.workspaceId, {
    applicationId: row.id,
    decision: 'revoked',
    reason: 'Synthetic revocation.',
  });
  assert.equal(revoked.status, 200, JSON.stringify(revoked.value));
  assert.equal((await readProfile(teams.agent, member(teams.one))).status, 404);
});
