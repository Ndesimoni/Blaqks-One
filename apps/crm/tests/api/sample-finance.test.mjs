import assert from 'node:assert/strict';
import { test } from 'node:test';
import { query } from './helpers.mjs';
import { edit, paymentBody, paymentFields, submit } from './finance-approval-helpers.mjs';
import { financePath, settingsBody } from './finance-helpers.mjs';
import { runSample, sampleAdmin, seed, staffEmail } from './sample-helpers.mjs';

const count = (sql) => Number(query(`SELECT count(*) FROM ${sql}`));
const states = (table, workspace) =>
  query(`SELECT string_agg(legacy_id||':'||status, ',' ORDER BY legacy_id) FROM ${table}
    WHERE workspace_id='${workspace}'`);
const userId = (email) => query(`SELECT id FROM crm_users WHERE email='${email}'`);

/** Every finance row of one workspace, by table. */
const finance = (workspace) => ({
  deals: count(`crm_deals WHERE workspace_id='${workspace}'`),
  snapshots: count(`crm_deal_snapshots WHERE workspace_id='${workspace}'`),
  lines: count(`crm_deal_commission_lines l JOIN crm_deal_snapshots s ON s.id=l.snapshot_id
    WHERE s.workspace_id='${workspace}'`),
  handovers: count(`crm_deal_handovers WHERE workspace_id='${workspace}'`),
  payments: count(`crm_payments WHERE workspace_id='${workspace}'`),
  expenses: count(`crm_expenses WHERE workspace_id='${workspace}'`),
  agreements: count(`crm_commission_agreements WHERE workspace_id='${workspace}'`),
  settings: count(`crm_finance_settings WHERE workspace_id='${workspace}'`),
  marked: count(`crm_sample_finance WHERE workspace_id='${workspace}'`),
});
const seeded = { deals: 6, snapshots: 3, lines: 2, handovers: 2, payments: 5, expenses: 3 };

test('seed-sample adds labelled finance in every state through the finance writes, once', async () => {
  const { admin, email, workspace } = await sampleAdmin('sample-finance-admin');
  const first = seed(email);
  assert.match(first.stdout, /Sample finance:/);
  assert.match(first.stdout, /Deals\s+6 added,\s+0 already present,\s+0 skipped/);
  assert.match(first.stdout, /Payments\s+5 added/);
  assert.deepEqual(finance(workspace), { ...seeded, agreements: 2, settings: 1, marked: 19 });
  const [layla, karim] = ['sample.layla', 'sample.karim'].map((h) => userId(staffEmail(h, email)));
  const deal = (id, columns) =>
    query(
      `SELECT ${columns} FROM crm_deals WHERE workspace_id='${workspace}' AND legacy_id='${id}'`,
    );
  assert.equal(deal('DL-S01', 'earned_on IS NULL'), 't');
  assert.equal(deal('DL-S01', 'assignee_id'), karim);
  assert.equal(
    deal(
      'DL-S04',
      `assignee_id||','||second_agent_id||','||second_agent_kind||','||second_agent_share_bp`,
    ),
    `${karim},${layla},referral,2000`,
  );
  assert.equal(deal('DL-S06', 'assignee_id'), admin.user.id);
  assert.equal(
    query(`SELECT string_agg(d.legacy_id||':'||s.split_source, ',' ORDER BY d.legacy_id)
      FROM crm_deal_snapshots s JOIN crm_deals d ON d.id=s.deal_id WHERE s.workspace_id='${workspace}'`),
    'DL-S02:agreement,DL-S03:agreement,DL-S06:owner',
  );
  assert.equal(
    query(`SELECT string_agg(status, ',' ORDER BY status) FROM crm_deal_handovers
      WHERE workspace_id='${workspace}'`),
    'approved,pending',
  );
  assert.equal(
    states('crm_payments', workspace),
    'PM-S01:approved,PM-S02:void,PM-S03:pending,PM-S04:rejected,PM-S05:approved',
  );
  assert.equal(states('crm_expenses', workspace), 'EX-S01:pending,EX-S02:approved,EX-S03:rejected');
  assert.equal(
    query(`SELECT string_agg(agent_share_bp::text, ',' ORDER BY agent_share_bp)
      FROM crm_commission_agreements WHERE workspace_id='${workspace}'`),
    '5500,6000',
  );
  assert.equal(
    query(`SELECT deal_ref||','||(payload->>'deal_id_optional') FROM crm_records
      WHERE workspace_id='${workspace}' AND legacy_id='LG-S01'`),
    'DL-S01,DL-S01',
  );
  assert.equal(
    query(`SELECT string_agg(DISTINCT source||':'||actor_id, ',') FROM crm_finance_events
      WHERE workspace_id='${workspace}'`),
    `sample:${admin.user.id}`,
  );
  const view = await admin.request(financePath(admin));
  assert.equal(view.status, 200, JSON.stringify(view.value));
  assert.equal(view.value.deals.length, 6);

  const second = seed(email);
  assert.match(second.stdout, /Deals\s+0 added,\s+6 already present/);
  assert.match(second.stdout, /Finance settings\s+0 added,\s+1 already present/);
  assert.deepEqual(finance(workspace), { ...seeded, agreements: 2, settings: 1, marked: 19 });
});

test('clear-sample removes only sample finance and refuses while people depend on it', async () => {
  const { admin, email, workspace } = await sampleAdmin('sample-finance-clear');
  // The team's own settings come first: the seed keeps them and clear never removes them.
  const settings = await admin.request(financePath(admin, '/settings'), {
    method: 'PUT',
    body: settingsBody({ maxReferralShareBp: 2500 }),
  });
  assert.equal(settings.status, 200, JSON.stringify(settings.value));
  assert.match(seed(email).stdout, /Finance settings\s+0 added,\s+0 already present,\s+1 skipped/);

  // A payment a person records on a sample deal blocks the clear.
  const own = await submit(
    admin,
    admin,
    'payments',
    paymentBody('DL-S06', { amountFils: 100_000 }),
  );
  const linked = runSample('clear-sample', { email, args: ['--include-edited'] });
  assert.equal(linked.status, 1);
  assert.match(linked.stderr, /link to sample records: Payments PM-001\. .*Nothing was changed\./);
  assert.equal(count(`crm_sample_finance WHERE workspace_id='${workspace}'`), 18);
  assert.equal(count(`crm_finance_settings WHERE workspace_id='${workspace}'`), 1);
  assert.equal(query(`SELECT status FROM crm_payments WHERE id='${own.id}'`), 'pending');

  // Without that payment, an app edit of a sample entry still needs --include-edited.
  const other = await sampleAdmin('sample-finance-edit');
  seed(other.email);
  const { payments } = (await other.admin.request(financePath(other.admin))).value;
  const pending = payments.find((payment) => payment.paymentId === 'PM-S03');
  const edited = await edit(
    other.admin,
    other.admin,
    'payments',
    pending,
    paymentFields(pending, { notes: 'Checked' }),
  );
  assert.equal(edited.status, 200, JSON.stringify(edited.value));
  const refused = runSample('clear-sample', { email: other.email });
  assert.equal(refused.status, 1);
  assert.match(refused.stderr, /were changed in the app: Payments PM-S03\./);
  const cleared = runSample('clear-sample', { email: other.email, args: ['--include-edited'] });
  assert.equal(cleared.status, 0, cleared.stderr);
  assert.match(cleared.stdout, /Deals\s+6 removed/);
  assert.match(cleared.stdout, /Payments\s+5 removed/);
  const empty = { deals: 0, snapshots: 0, lines: 0, handovers: 0, payments: 0, expenses: 0 };
  assert.deepEqual(finance(other.workspace), { ...empty, agreements: 0, settings: 0, marked: 0 });
  assert.equal(
    count(`crm_finance_events WHERE workspace_id='${other.workspace}' AND action='deleted'
      AND source='sample'`),
    6 + 5 + 3 + 2 + 1,
  );
  // Seeding again restores everything, and outside the sample command deletes stay refused.
  assert.match(seed(other.email).stdout, /Deals\s+6 added/);
  assert.equal(finance(other.workspace).marked, 19);
  assert.throws(() => query(`DELETE FROM crm_payments WHERE workspace_id='${other.workspace}'`));
  assert.throws(() =>
    query(`DELETE FROM crm_commission_agreements
    WHERE workspace_id='${other.workspace}'`),
  );
});
