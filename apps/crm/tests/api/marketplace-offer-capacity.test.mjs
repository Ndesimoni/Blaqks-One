import assert from 'node:assert/strict';
import { test } from 'node:test';
import { approvedCompany, currentTerms, join, joinBody, market } from './marketplace-helpers.mjs';
import { client, postHeld, requestTeams } from './marketplace-request-helpers.mjs';
import { held } from './record-sharing-helpers.mjs';
import { activate, invite } from './team-helpers.mjs';
import { query } from './helpers.mjs';

test('racing offers cannot exceed three; rejection frees a slot for a different property', async () => {
  const teams = await requestTeams('market-capacity');
  const fourth = await activate(
    await invite(teams.owner, 'market-capacity-four', { accountRole: 'admin', positions: [] }),
  );
  await approvedCompany(fourth, teams.owner);
  await join(fourth, joinBody(await currentTerms(fourth)));
  const req = await postHeld(teams.one, (await client(teams, 'one')).id);
  const path = `/requests/${req.id}/offers`;
  const prepare = async (who, suffix) => {
    const owner = who.user.workspaceId === fourth.user.workspaceId ? fourth : teams.other;
    const record = await held(owner, who, 'Properties', {
      property_id: `MK-CAP-${suffix}`,
      listing_title: 'Synthetic capacity apartment',
      sale_rental: 'Rental',
      property_type: 'Apartment',
      emirate: 'Dubai',
      community: 'Dubai Marina',
      bedrooms: '2',
      listing_status: 'Available',
      price_annual_rent_aed: '110000',
    });
    const preview = await market(who, `${path}/preview`, {
      method: 'POST',
      body: { recordId: record.id },
    });
    assert.equal(preview.status, 200, JSON.stringify(preview.value));
    return () =>
      market(who, path, {
        method: 'POST',
        body: {
          recordId: record.id,
          previewDigest: preview.value.previewDigest,
          checked: true,
        },
      });
  };
  const people = [teams.agent, teams.colleague, teams.other, fourth];
  const sends = [];
  for (const [index, person] of people.entries()) sends.push(await prepare(person, index));
  assert.equal((await sends[0]()).status, 201);
  assert.equal((await sends[1]()).status, 201);
  const raced = await Promise.all([sends[2](), sends[3]()]);
  assert.deepEqual(raced.map((r) => r.status).sort(), [201, 409]);
  let detail = (await market(teams.one, path)).value;
  assert.equal(detail.request.activeOffers, 3);
  const rejected = detail.answers.find((a) => a.memberId === teams.agent.user.id);
  assert.equal(
    (await market(teams.one, `${path}/${rejected.id}/reject`, { method: 'POST' })).status,
    200,
  );
  assert.equal((await sends[0]()).status, 409, 'same property cannot be offered twice');
  const replacement = await prepare(teams.agent, 'replacement');
  assert.equal((await replacement()).status, 201);
  detail = (await market(teams.one, path)).value;
  assert.equal(detail.request.activeOffers, 3);
  assert.equal(detail.answers.length, 4);
  const full = await market(teams.other, '/board');
  assert.equal(
    full.value.requests.some((row) => row.id === req.id),
    false,
  );
  const expiring = detail.answers.find((answer) => answer.state === 'waiting');
  query(
    `SET session_replication_role=replica; UPDATE agreements.crm_listing_shares SET created_at=created_at-interval '16 days',offer_ends_at=offer_ends_at-interval '16 days',view_ends_at=view_ends_at-interval '16 days' WHERE id='${expiring.shareId}'`,
  );
  const reopened = await market(teams.other, '/board');
  assert.equal(reopened.status, 200, JSON.stringify(reopened.value));
  const visible = reopened.value.requests.find((row) => row.id === req.id);
  assert.ok(visible, 'expired offers free capacity directly on board read');
  assert.equal(visible.hasMatches, true, 'match alert reads only the caller inventory');
});
