import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { api, query } from './helpers.mjs';
import { jpegPhoto, upload } from './media-helpers.mjs';
import {
  approvedCompany,
  currentTerms,
  join,
  joinBody,
  leave,
  market,
  marketPath,
  marketTeams,
} from './marketplace-helpers.mjs';

// The MK1 code review fixes (docs/broker-marketplace.md §16): profile text, consents, newer
// terms, leaving and the photo.
let teams;
before(async () => {
  teams = await marketTeams('market-review');
  await approvedCompany(teams.admin, teams.owner);
  await approvedCompany(teams.other, teams.owner);
  const joined = await join(teams.other, joinBody(await currentTerms(teams.other)));
  assert.equal(joined.status, 201, JSON.stringify(joined.value));
});

const withCommunities = async (session, communities) => {
  const body = joinBody(await currentTerms(session));
  return join(session, { ...body, profile: { ...body.profile, communities } });
};

/** A PNG header claiming `width` × `height`; uploads check the chunks, not the pixels. */
const png = (width, height) => {
  const chunk = (type, data) => {
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    return Buffer.concat([length, Buffer.from(type), data, Buffer.alloc(4)]);
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return Buffer.concat([signature, chunk('IHDR', header), chunk('IEND', Buffer.alloc(0))]);
};

test('community names cannot carry a phone number, a domain or another script', async () => {
  for (const communities of [
    ['Marina ٠٥٠١٢٣٤٥٦٧'],
    ['Marina ０５０１２３４５６７'],
    ['simonihomes.ae'],
    ['JVC 050 123', '4567 Marina'],
  ]) {
    const refused = await withCommunities(teams.one, communities);
    assert.equal(refused.status, 400, `${communities}: ${JSON.stringify(refused.value)}`);
  }
});

test('newer terms need a joined member and every tick; leaving needs a profile', async () => {
  const terms = await currentTerms(teams.admin);
  const accept = (session, commitments) =>
    market(session, '/terms/accept', {
      method: 'POST',
      body: { termsVersion: terms.version, termsDigest: terms.digest, commitments, consent: true },
    });
  const outsider = await accept(teams.admin, [true, true, true, true]);
  assert.equal(outsider.status, 409, 'the Admin has not joined');
  assert.equal((await leave(teams.admin)).status, 409);
  assert.equal((await join(teams.two, joinBody(terms))).status, 201);
  const unticked = await accept(teams.two, [true, true, true, false]);
  assert.equal(unticked.status, 400, JSON.stringify(unticked.value));
});

test('joining again after leaving records a fresh consent', async () => {
  const terms = await currentTerms(teams.one);
  assert.equal((await join(teams.one, joinBody(terms))).status, 201);
  assert.equal((await leave(teams.one)).status, 200);
  assert.equal((await join(teams.one, joinBody(terms))).status, 201);
  const count = (table) =>
    query(`SELECT count(*) FROM marketplace.${table} WHERE member_id='${teams.one.user.id}'`);
  assert.equal(count('crm_market_consents'), '2');
  assert.equal(count('crm_market_acceptances'), '1');
});

test('a photo is at most 2048 pixels a side and never keeps the name it was uploaded with', async () => {
  const put = (mediaId) => market(teams.one, '/me/photo', { method: 'PUT', body: { mediaId } });
  const wide = await upload(teams.one, png(3000, 10), 'wide.png');
  assert.equal(wide.status, 201, JSON.stringify(wide.value));
  assert.equal((await put(wide.value.media.id)).status, 400);
  const named = await upload(teams.one, jpegPhoto(), 'call 0501234567.jpg');
  const attached = await put(named.value.media.id);
  assert.equal(attached.status, 200, JSON.stringify(attached.value));
  const path = marketPath(teams.other, `/profiles/${teams.one.user.id}/photo`);
  const served = await fetch(`${api}${path}`, { headers: { Cookie: teams.other.cookie } });
  assert.equal(served.status, 200);
  const disposition = served.headers.get('content-disposition') || '';
  assert.match(disposition, /profile-photo\.jpg/);
  assert.doesNotMatch(disposition, /0501234567/);
});
