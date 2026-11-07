import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { before, test } from 'node:test';
import {
  apply,
  market,
  marketTeams,
  ready,
  status,
  TERMS_VERSION,
} from './marketplace-helpers.mjs';

// The MK1 code review's access fixes: staff see ticks, not counts (L8); staff cannot use up
// the Admin's application tries (L7); every member route has the one gate (L11).
let teams;
before(async () => {
  teams = await marketTeams('market-access');
  await ready(teams.admin);
});

test('staff see which lines are met; only the Admin sees the counts', async () => {
  const mine = (await status(teams.admin)).company.checklist;
  assert.ok(Number.isInteger(mine.properties) && mine.properties >= 5);
  assert.equal(mine.lines.properties, true);
  const theirs = (await status(teams.one)).company.checklist;
  for (const key of ['ageDays', 'properties', 'clients', 'contacts', 'followUps', 'viewings'])
    assert.equal(theirs[key], null, key);
  assert.deepEqual(theirs.lines, mine.lines);
  assert.equal(theirs.met, true);
});

test('staff attempts never use the company’s five applications an hour', async () => {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const refused = await market(teams.one, '/application', { method: 'POST' });
    assert.equal(refused.status, 403, JSON.stringify(refused.value));
  }
  const applied = await apply(teams.admin);
  assert.equal(applied.company.state, 'pending');
});

test('every member route gives outsiders the same not-found', async () => {
  const member = teams.one.user.id;
  const routes = [
    ['/status'],
    [`/terms/${TERMS_VERSION}`],
    ['/application', { method: 'POST' }],
    ['/company', { method: 'PUT', body: { enabled: false, expectedVersion: 0 } }],
    ['/join', { method: 'POST', body: {} }],
    ['/me', { method: 'PATCH', body: {} }],
    ['/terms/accept', { method: 'POST', body: {} }],
    ['/me/photo', { method: 'PUT', body: { mediaId: randomUUID() } }],
    ['/me/photo', { method: 'DELETE' }],
    ['/leave', { method: 'POST' }],
    [`/profiles/${member}`],
    [`/profiles/${member}/photo`],
  ];
  const outsiders = [
    [teams.owner, teams.admin.user.workspaceId],
    [teams.other, teams.admin.user.workspaceId],
    [teams.one, 'super-admin-workspace'],
  ];
  const bodies = new Set();
  for (const [session, workspace] of outsiders) {
    for (const [tail, options] of routes) {
      const result = await market(session, tail, options || {}, workspace);
      assert.equal(result.status, 404, `${tail} ${options?.method || 'GET'}`);
      bodies.add(JSON.stringify(result.value));
    }
  }
  assert.equal(bodies.size, 1, [...bodies].join(' | '));
});
