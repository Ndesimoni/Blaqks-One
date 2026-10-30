import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { setAssignee } from './assignment-helpers.mjs';
import { findMember, memberUpdate, teamPath } from './team-helpers.mjs';
import {
  accepted,
  copy,
  held,
  keepCount,
  shareState,
  sharingTeams,
} from './record-sharing-helpers.mjs';

let teams;
before(async () => {
  teams = await sharingTeams('share-lifecycle');
});

async function update(staff, changes) {
  const member = await findMember(teams.admin, staff.user.id);
  const result = await teams.admin.request(teamPath(teams.admin, member.id), {
    method: 'PATCH',
    body: memberUpdate(member, changes),
  });
  assert.equal(result.status, 200, JSON.stringify(result.value));
}

async function acceptedClient(suffix, receiver) {
  const record = await held(teams.admin, teams.one, 'Clients', {
    client_id: `SHARE-LIFE-${suffix}`,
    full_name: `Synthetic Lifecycle ${suffix}`,
  });
  return { record, share: await accepted(teams.one, record, receiver) };
}

function ended(share, label) {
  assert.equal(shareState(share), 'ended|-', label);
  assert.equal(keepCount(share), '0', `${label} keep removed`);
}

test('holder reassignment ends an accepted share and removes its copy', async () => {
  const { record, share } = await acceptedClient('REASSIGN', teams.two);
  assert.equal(keepCount(share), '1');
  assert.ok((await copy(teams.two, 'Clients', record.id)).entry);
  setAssignee(record.id, teams.third.user.id);
  ended(share, 'reassignment');
  assert.equal((await copy(teams.two, 'Clients', record.id)).entry, undefined);
});

test('receiver departure ends an accepted share and deletes its keep', async () => {
  const { share } = await acceptedClient('DEPART', teams.two);
  await update(teams.two, { active: false });
  ended(share, 'departure');
});

test('receiver collection-grant loss ends only the affected accepted share', async () => {
  const { share } = await acceptedClient('GRANT', teams.third);
  const member = await findMember(teams.admin, teams.third.user.id);
  await update(teams.third, {
    permissions: { ...member.permissions, relationships: false },
  });
  ended(share, 'grant loss');
});
