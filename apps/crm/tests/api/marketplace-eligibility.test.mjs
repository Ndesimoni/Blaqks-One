import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { query } from './helpers.mjs';
import {
  applications,
  apply,
  decide,
  market,
  marketTeams,
  ready,
  status,
} from './marketplace-helpers.mjs';

// Company eligibility, the application and the platform's decision (§15, packet MK1a).
let teams;
before(async () => {
  teams = await marketTeams('market-eligibility');
});

test('a fresh company is not applied, with every line still failing', async () => {
  const fresh = await status(teams.admin);
  assert.equal(fresh.company.state, 'not_applied');
  assert.equal(fresh.company.enabled, true);
  assert.equal(fresh.company.version, 0);
  assert.equal(fresh.company.checklist.met, false);
  assert.equal(fresh.company.checklist.ageDays, 0);
  assert.equal(fresh.company.checklist.properties, 0);
  assert.equal(fresh.member.joined, false);
  assert.equal(fresh.member.profile, null);
  const refused = await market(teams.admin, '/application', { method: 'POST' });
  assert.equal(refused.status, 409, JSON.stringify(refused.value));
  assert.match(refused.value.message, /checklist/);
});

test('a company that uses the CRM meets the checklist and its Admin applies', async () => {
  await ready(teams.admin);
  const readyState = await status(teams.admin);
  assert.equal(readyState.company.checklist.met, true, JSON.stringify(readyState));
  assert.ok(readyState.company.checklist.ageDays >= 7);
  assert.equal(readyState.company.checklist.recent, true);

  const staff = await market(teams.one, '/application', { method: 'POST' });
  assert.equal(staff.status, 403, JSON.stringify(staff.value));

  const applied = await apply(teams.admin);
  assert.equal(applied.company.state, 'pending');
  assert.equal((await status(teams.admin)).company.state, 'pending');

  const again = await market(teams.admin, '/application', { method: 'POST' });
  assert.equal(again.status, 409, JSON.stringify(again.value));
});

test('the Super Admin reads the counts only and approves the pending application', async () => {
  const queue = await applications(teams.owner, 'pending');
  assert.equal(queue.status, 200, JSON.stringify(queue.value));
  const row = queue.value.applications.find(
    (item) => item.workspaceId === teams.admin.user.workspaceId,
  );
  assert.ok(row, JSON.stringify(queue.value));
  assert.equal(row.state, 'pending');
  assert.equal(row.counts.properties, 5);
  assert.equal(row.counts.clients, 5);
  assert.equal(row.counts.contacts, 3);
  assert.equal(row.counts.followUps, 3);
  assert.equal(row.counts.viewings, 1);
  assert.ok(row.appliedBy);
  assert.ok(row.companyCreatedAt);
  assert.equal(row.records, undefined, 'no records reach the platform');

  const approved = await decide(teams.owner, teams.admin.user.workspaceId, {
    applicationId: row.id,
    decision: 'approved',
  });
  assert.equal(approved.status, 200, JSON.stringify(approved.value));
  assert.equal((await status(teams.admin)).company.state, 'approved');
  const twice = await decide(teams.owner, teams.admin.user.workspaceId, {
    applicationId: row.id,
    decision: 'approved',
  });
  assert.equal(twice.status, 409, JSON.stringify(twice.value));
});

test('a declined company gets the reason and the day it may apply again', async () => {
  await ready(teams.other);
  await apply(teams.other);
  const queue = await applications(teams.owner, 'pending');
  const row = queue.value.applications.find(
    (item) => item.workspaceId === teams.other.user.workspaceId,
  );
  assert.ok(row);
  const noReason = await decide(teams.owner, teams.other.user.workspaceId, {
    applicationId: row.id,
    decision: 'declined',
  });
  assert.equal(noReason.status, 400, JSON.stringify(noReason.value));
  const declined = await decide(teams.owner, teams.other.user.workspaceId, {
    applicationId: row.id,
    decision: 'declined',
    reason: 'The company is not ready yet.',
  });
  assert.equal(declined.status, 200, JSON.stringify(declined.value));
  const company = (await status(teams.other)).company;
  assert.equal(company.state, 'declined');
  assert.equal(company.declineReason, 'The company is not ready yet.');
  const wait = (Date.parse(company.canApplyFrom) - Date.now()) / 3600e3;
  assert.ok(wait > 71 && wait <= 72, company.canApplyFrom);
  const early = await market(teams.other, '/application', { method: 'POST' });
  assert.equal(early.status, 409, JSON.stringify(early.value));
  assert.match(early.value.message, /three days/);
});

test('only an approved company can be revoked, and a revocation stops applying', async () => {
  const all = await applications(teams.owner, 'all');
  const declined = all.value.applications.find(
    (item) => item.workspaceId === teams.other.user.workspaceId,
  );
  assert.ok(declined);
  const refused = await decide(teams.owner, teams.other.user.workspaceId, {
    applicationId: declined.id,
    decision: 'revoked',
    reason: 'Stop.',
  });
  assert.equal(refused.status, 409, JSON.stringify(refused.value));
  const approvedRow = all.value.applications.find(
    (item) => item.workspaceId === teams.admin.user.workspaceId,
  );
  assert.ok(approvedRow);
  const revoked = await decide(teams.owner, teams.admin.user.workspaceId, {
    applicationId: approvedRow.id,
    decision: 'revoked',
    reason: 'Access paused after a review.',
  });
  assert.equal(revoked.status, 200, JSON.stringify(revoked.value));
  const company = (await status(teams.admin)).company;
  assert.equal(company.state, 'revoked');
  assert.equal(company.declineReason, 'Access paused after a review.');
  const early = await market(teams.admin, '/application', { method: 'POST' });
  assert.equal(early.status, 409, JSON.stringify(early.value));
  const stored = query(
    `SELECT count(*) FROM marketplace.crm_market_decisions WHERE workspace_id='${teams.admin.user.workspaceId}' AND decision='revoked' AND application_id IS NULL`,
  );
  assert.equal(stored, '1');
});
