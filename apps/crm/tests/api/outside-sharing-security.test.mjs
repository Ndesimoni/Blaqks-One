import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { before, test } from 'node:test';
import { jpegWithGps, upload } from './media-helpers.mjs';
import {
  accepted,
  act,
  fileStatus,
  listing,
  listingRequest,
  outsideTeams,
  preview,
  read,
  send,
  sendBody,
} from './outside-sharing-helpers.mjs';

// R2a security (review amendment 6): one identical not-found for everyone outside a share,
// the Super Admin included; the receiving Admin reads the introduction record only.
let teams;
before(async () => {
  teams = await outsideTeams('outside-security');
});

async function withPhoto() {
  const photo = (await upload(teams.admin, jpegWithGps(), 'front.jpg')).value.media.id;
  return listing(teams, 'one', {
    media_photos: [{ name: 'front.jpg', type: 'image/jpeg', file: photo }],
  });
}

test('only the holder or the Admin sends, and only to a live member of another company', async () => {
  const record = await listing(teams);
  const body = { recordId: record.id, exactLocation: false };
  const hidden = await listingRequest(teams.two, '/preview', { method: 'POST', body });
  assert.equal(hidden.status, 404, 'a colleague who cannot see it');
  await preview(teams.admin, record);
  const review = await preview(teams.one, record);
  for (const to of [teams.two, teams.admin, teams.one]) {
    const refused = await listingRequest(teams.one, '', {
      method: 'POST',
      body: sendBody(record, to, review),
    });
    assert.equal(refused.status, 400, JSON.stringify(refused.value));
  }
  const owner = { user: { id: teams.owner.user.id, workspaceId: 'super-admin-workspace' } };
  const toOwner = await listingRequest(teams.one, '', {
    method: 'POST',
    body: sendBody(record, owner, review),
  });
  assert.equal(toOwner.status, 400, 'never the Super Admin');
  const fromOwner = await listingRequest(
    teams.owner,
    '/preview',
    { method: 'POST', body },
    teams.admin.user.workspaceId,
  );
  assert.equal(fromOwner.status, 404);
});

test('everyone outside the share gets the same not-found on every route', async () => {
  const record = await withPhoto();
  const share = await accepted(teams.one, record, teams.agent);
  const file = (await read(teams.one, share)).photos[0].file;
  const unknown = (await listingRequest(teams.two, `/${randomUUID()}`)).value;
  for (const outsider of [teams.two, teams.colleague, teams.owner]) {
    const workspace = outsider === teams.owner ? teams.admin.user.workspaceId : undefined;
    for (const tail of ['', '/evidence']) {
      const found = await listingRequest(outsider, `/${share.id}${tail}`, {}, workspace);
      assert.equal(found.status, 404, `${outsider.user.name} ${tail}`);
      assert.deepEqual(found.value, unknown);
    }
    for (const action of ['accept', 'decline', 'withdraw', 'stop']) {
      const result = await listingRequest(
        outsider,
        `/${share.id}/${action}`,
        { method: 'POST' },
        workspace,
      );
      assert.equal(result.status, 404, `${outsider.user.name} ${action}`);
    }
    if (outsider !== teams.owner) assert.equal(await fileStatus(outsider, share, file), 404);
  }
  const extend = await act(teams.agent, share, 'extend', { viewEndsOn: '2099-01-01' });
  assert.ok([400, 404].includes(extend.status), 'the agent never extends');
  assert.equal((await act(teams.agent, share, 'stop')).status, 404, 'nor stops');
});

test('the receiving Admin reads the introduction record but never acts or sees photos', async () => {
  const record = await withPhoto();
  const share = await send(teams.one, record, teams.agent);
  const pending = await read(teams.other, share);
  assert.equal(pending.viewer, 'agentAdmin');
  assert.equal(pending.listing.description, undefined);
  assert.ok(
    Object.entries(pending.allowed).every(([name, value]) => name === 'evidence' || !value),
  );
  assert.equal((await act(teams.other, share, 'accept')).status, 404, 'never for the agent');
  assert.equal((await act(teams.agent, share, 'accept')).status, 200);
  const open = await read(teams.other, share);
  assert.deepEqual([open.photos, open.listing.description], [[], undefined]);
  const file = (await read(teams.agent, share)).photos[0].file;
  assert.equal(await fileStatus(teams.other, share, file), 404);
  assert.equal((await act(teams.one, share, 'stop')).status, 200);
  assert.equal((await read(teams.other, share)).listing, null, 'closure removes the facts');
  assert.equal((await read(teams.agent, share)).listing, null);
  assert.equal(await fileStatus(teams.agent, share, file), 404);
  assert.equal(await fileStatus(teams.one, share, file), 200, 'the sender keeps the copies');
});

test('looking up agents by email is limited to twenty an hour', async () => {
  const path = `/workspaces/${teams.colleague.user.workspaceId}/agreements/recipients`;
  const lookup = () =>
    teams.colleague.request(path, {
      method: 'POST',
      body: { email: `nobody-${randomUUID()}@example.test` },
    });
  for (let index = 0; index < 20; index += 1) assert.equal((await lookup()).status, 404);
  const limited = await lookup();
  assert.equal(limited.status, 429, JSON.stringify(limited.value));
});
