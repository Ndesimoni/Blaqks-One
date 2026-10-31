import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { query } from './helpers.mjs';
import { activate, findMember, invite, memberUpdate, teamPath } from './team-helpers.mjs';
import { archive, archiveReview } from './archive-helpers.mjs';
import { actions, FINANCE, grant } from './permission-helpers.mjs';
import { events, refused } from './finance-helpers.mjs';
import { DEAL_MESSAGES as M, createDeal, dealPath, dealTeams } from './finance-deals-helpers.mjs';
import { earnDeal, heldClient, post } from './finance-deals-helpers.mjs';

let teams;
before(async () => {
  teams = await dealTeams('fin-leave');
});

const update = async (staff, changes) => {
  const member = await findMember(teams.admin, staff.user.id);
  const result = await teams.admin.request(teamPath(teams.admin, member.id), {
    method: 'PATCH',
    body: memberUpdate(member, changes),
  });
  assert.equal(result.status, 200, JSON.stringify(result.value));
};
const holder = (deal) => query(`SELECT assignee_id FROM crm_deals WHERE id='${deal.id}'`);
const agent = async (name) =>
  activate(await invite(teams.admin, `fin-leave-${name}`, { positions: ['property-agent'] }));

test('departure releases held deals, earned or not, keeps lines and cancels hand-overs', async () => {
  const { admin, second } = teams;
  const leaver = await agent('leaver');
  const client = await heldClient(leaver);
  const earned = await earnDeal(admin, await createDeal(leaver, client));
  const open = await createDeal(leaver, client);
  const theirs = await createDeal(second, await heldClient(second));
  const offered = await post(second, admin, theirs.id, 'handovers', {
    version: theirs.version,
    toId: leaver.user.id,
    referralShareBp: null,
  });
  assert.equal(offered.status, 201, JSON.stringify(offered.value));
  await update(leaver, { active: false });
  assert.deepEqual([holder(earned), holder(open)], ['', '']);
  const lines = query(`SELECT count(*) FROM crm_deal_commission_lines l JOIN crm_deal_snapshots s
    ON s.id=l.snapshot_id WHERE s.deal_id='${earned.id}' AND l.agent_id='${leaver.user.id}'`);
  assert.equal(lines, '1', 'earned lines stay attributed to the departed agent');
  const status = query(
    `SELECT status FROM crm_deal_handovers WHERE id='${offered.value.handover.id}'`,
  );
  assert.equal(status, 'cancelled');
  const released = events(open.id).at(-1);
  assert.equal(released.reason, 'The holder left the team.');
  assert.deepEqual(released.changes, { assignee: [leaver.user.id, null] });
  const reasons = query(`SELECT string_agg(reason, ',' ORDER BY created_at) FROM crm_assignments
    WHERE record_id='${earned.id}'`);
  assert.equal(reasons, 'created,departure');
});

test('losing the finance module releases deals; losing team finance releases nothing', async () => {
  const { admin, viewer } = teams;
  const member = await agent('module');
  const deal = await createDeal(member, await heldClient(member));
  await update(member, { permissions: { ...member.user.permissions, finance: false } });
  assert.equal(holder(deal), '');
  assert.equal(events(deal.id).at(-1).reason, 'The holder no longer has finance access.');
  const kept = await createDeal(viewer, await heldClient(viewer));
  const current = await findMember(admin, viewer.user.id);
  await update(viewer, { actions: { ...current.actions, finance: FINANCE.preset } });
  assert.equal(holder(kept), viewer.user.id);
});

test('archiving a staff member releases their deals; earning refuses an inactive second agent', async () => {
  const { admin, owner, agent: holderAgent } = teams;
  const leaving = await agent('archive');
  const deal = await createDeal(leaving, await heldClient(leaving));
  const review = await archiveReview(owner, admin, { id: leaving.user.id });
  assert.equal((await archive(owner, admin, review)).status, 200);
  assert.equal(holder(deal), '');
  const shared = await createDeal(holderAgent, await heldClient(holderAgent));
  const helper = await agent('helper');
  const split = await admin.request(dealPath(admin, `/${shared.id}/split`), {
    method: 'PUT',
    body: {
      version: 1,
      secondAgentId: helper.user.id,
      secondAgentShareBp: 1000,
      overrideAgentShareBp: null,
      reason: 'Synthetic',
    },
  });
  await update(helper, { active: false });
  const earn = await post(admin, admin, shared.id, 'earn', {
    version: split.value.deal.version,
    earnedOn: query(`SELECT ((now() AT TIME ZONE 'Asia/Dubai')::date)::text`),
  });
  refused(earn, 409, M.secondGone, 'conflict');
});

test('M-C: Client deletes and renames need team finance; deal links keep the FK 409', async () => {
  const { admin } = teams;
  const deleter = await agent('deleter');
  const full = actions();
  const team = await grant(admin, deleter, { recordScope: 'team', actions: full });
  assert.equal(team.user.recordActions.Clients.delete, false, 'no team finance');
  assert.equal(team.user.recordActions.Contacts.delete, true);
  const records = `/workspaces/${admin.user.workspaceId}/records/Clients`;
  const client = await admin.request(records, { method: 'POST', body: { record: {} } });
  const remove = (session) =>
    session.request(`${records}/${client.value.id}`, { method: 'DELETE', body: { version: 1 } });
  refused(await remove(team), 403, 'Ask your Admin to delete this record.', 'forbidden');
  const finance = { ...FINANCE.preset, teamView: true };
  const viewer = await grant(admin, team, { actions: { ...full, finance } });
  assert.equal(viewer.user.recordActions.Clients.delete, true);
  await createDeal(admin, client.value.record.client_id);
  refused(await remove(viewer), 409, 'A linked record prevents this change.', 'conflict');
  refused(await remove(admin), 409, 'A linked record prevents this change.', 'conflict');
});
