import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { query } from './helpers.mjs';
import { activate, invite } from './team-helpers.mjs';
import { day, failure } from './finance-helpers.mjs';
import { createDeal, dealPath, dealTeams, earnDeal, heldClient } from './finance-deals-helpers.mjs';

let teams, earned, open, snapshot, foreignStaff;
before(async () => {
  teams = await dealTeams('fin-trig');
  const { admin, agent, second } = teams;
  const client = await heldClient(agent);
  const deal = await createDeal(agent, client);
  const split = await admin.request(dealPath(admin, `/${deal.id}/split`), {
    method: 'PUT',
    body: {
      version: 1,
      secondAgentId: second.user.id,
      secondAgentShareBp: 2000,
      overrideAgentShareBp: null,
      reason: 'Synthetic',
    },
  });
  earned = await earnDeal(admin, split.value.deal);
  open = await createDeal(agent, client);
  snapshot = query(`SELECT id FROM crm_deal_snapshots WHERE deal_id='${earned.id}'`);
  foreignStaff = (await activate(await invite(teams.other, 'fin-trig-foreign'))).user.id;
});

const deals = (set, id = earned.id) => `UPDATE crm_deals SET ${set} WHERE id='${id}'`;

test('snapshots and commission lines are append-only (P0F07)', () => {
  for (const sql of [
    `UPDATE crm_deal_snapshots SET net_fils=net_fils+1 WHERE id='${snapshot}'`,
    `UPDATE crm_deal_snapshots SET reason='x' WHERE id='${snapshot}'`,
    `DELETE FROM crm_deal_snapshots WHERE id='${snapshot}'`,
    `UPDATE crm_deal_commission_lines SET amount_fils=0 WHERE snapshot_id='${snapshot}'`,
    `DELETE FROM crm_deal_commission_lines WHERE snapshot_id='${snapshot}'`,
  ]) {
    assert.match(failure(sql), /append-only/, sql);
  }
  const line = `INSERT INTO crm_deal_commission_lines (snapshot_id,role,agent_id,share_bp,
    amount_fils) VALUES ('${snapshot}','second','${foreignStaff}',1,0)`;
  assert.match(failure(line.replace("'second'", "'primary'")), /duplicate key|not eligible/);
  const fresh = `BEGIN; INSERT INTO crm_deal_snapshots (id,deal_id,workspace_id,revision,
    earned_on,inputs,split_source,vat_registered,vat_rate_bp,gross_fils,partner_fils,net_fils,
    company_fils,vat_fils,actor_id) VALUES (gen_random_uuid(),'${open.id}',
    '${teams.admin.user.workspaceId}',1,'${day(0)}','{}','owner',false,500,100,0,100,90,0,
    '${teams.admin.user.id}'); COMMIT;`;
  assert.match(failure(fresh), /does not add up/);
});

test('earned terms, the earned date and the split are locked off the Admin path (P0F05)', () => {
  for (const set of [
    'agreed_value_fils=1',
    'partner_share_bp=100',
    'earned_on=NULL',
    'second_agent_id=NULL,second_agent_share_bp=NULL,second_agent_kind=NULL',
    "override_agent_share_bp=1,override_reason='x'",
    "deal_type='Rental'",
  ]) {
    assert.match(failure(deals(set)), /Earned deal terms are locked/, set);
  }
  assert.match(failure(`DELETE FROM crm_deals WHERE id='${earned.id}'`), /cannot be deleted/);
  const bypass = `BEGIN; SELECT set_config('kws.finance_admin','on',true);
    ${deals('agreed_value_fils=agreed_value_fils')}; ${deals('partner_share_bp=1')}; ROLLBACK;`;
  query(bypass);
  query(deals('stage=\'Completed\', details=\'{"notes":"x"}\''));
});

test('deal identity is fixed and members must belong to the workspace (P0F06, P0F04)', () => {
  assert.match(failure(deals("legacy_id='DL-999'", open.id)), /identity cannot change/);
  const second = `second_agent_id='${foreignStaff}',second_agent_share_bp=1,second_agent_kind='split'`;
  assert.match(failure(deals(second, open.id)), /not active staff/);
  const admin = `second_agent_id='${teams.admin.user.id}',second_agent_share_bp=1,
    second_agent_kind='split'`;
  assert.match(failure(deals(admin, open.id)), /not active staff/);
  assert.match(failure(deals(`assignee_id='${foreignStaff}'`, open.id)), /not an active member/);
  assert.match(failure(deals('second_agent_share_bp=1', open.id)), /crm_deals_second/);
  assert.match(failure(deals('fee_rate_bp=NULL', open.id)), /crm_deals_fee/);
  assert.match(failure(deals('agreed_value_fils=1000000000001', open.id)), /check/);
});

test('0012–0014 extend history checks and replace the M-F3 placeholder', () => {
  const ws = teams.admin.user.workspaceId;
  const agent = teams.agent.user.id;
  const applies = (starts) =>
    query(`SELECT crm_agreement_applies_to_earned('${ws}','${agent}','${starts}')`);
  assert.equal(applies(day(0)), 't');
  assert.equal(applies(day(1)), 'f');
  assert.equal(query(`SELECT crm_deal_approved_fils('${earned.id}')`), '0');
  const history = query(`SELECT string_agg(DISTINCT reason, ',') FROM crm_assignments
    WHERE record_id IN ('${earned.id}','${open.id}')`);
  assert.equal(history, 'created');
  const activity = query(`SELECT count(*) FROM crm_activity WHERE collection='Deals'
    AND record_id='${earned.id}' AND action='earned'`);
  assert.equal(activity, '1');
  const leaked = query(`SELECT count(*) FROM crm_finance_events WHERE changes::text ~ 'Synthetic'`);
  assert.equal(leaked, '0', 'notes and reasons never enter changes');
});
