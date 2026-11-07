import assert from 'node:assert/strict';
import { test } from 'node:test';
import { query } from './helpers.mjs';
import {
  idKeys,
  sampleAdmin,
  sampleCounts,
  sampleRows,
  seed,
  signIn,
  staffEmail,
  visible,
} from './sample-helpers.mjs';

const ids = (prefix, numbers) => numbers.map((n) => `${prefix}-S${String(n).padStart(2, '0')}`);

test('seed-sample fills one Admin workspace with linked, assigned and labelled records', async () => {
  const { admin, email, workspace } = await sampleAdmin('sample-seed-admin');
  const first = seed(email);
  assert.match(first.stdout, /Total\s+52 added,\s+0 already present/);
  const sql = (where) => Number(query(`SELECT count(*) FROM crm_records WHERE ${where}`));
  for (const [collection, count] of Object.entries(sampleCounts)) {
    assert.equal(sql(`workspace_id='${workspace}' AND collection='${collection}'`), count);
  }
  assert.equal(sampleRows(workspace), 52);
  assert.equal(
    sql(`workspace_id='${workspace}' AND collection='Properties' AND contact_id IS NULL`),
    0,
  );
  const children = `workspace_id='${workspace}' AND collection NOT IN ('Clients','Contacts','Properties')`;
  assert.equal(sql(`${children} AND client_ref IS NULL`), 0);
  assert.equal(sql(`${children} AND client_ref NOT LIKE 'CL-S%'`), 0);
  const referrals = query(`SELECT string_agg(legacy_id||'>'||referral_ref, ',' ORDER BY legacy_id)
    FROM crm_records WHERE workspace_id='${workspace}' AND referral_ref IS NOT NULL`);
  assert.equal(referrals, 'CA-S02>CL-S10,CL-S10>CL-S07');
  assert.equal(
    sql(`workspace_id='${workspace}' AND payload->>'full_name' NOT LIKE 'Sample · %'
    AND collection IN ('Clients','Contacts')`),
    0,
  );
  // Activity names the Admin as actor, never a sample member, and holds no payloads.
  // Finance adds 6 deals, 5 payments and 3 expenses, 2 deal moves and their decisions.
  const activity = query(`SELECT string_agg(action||':'||count, ',' ORDER BY action) FROM
    (SELECT action, count(*) FROM crm_activity WHERE workspace_id='${workspace}'
     AND actor_id='${admin.user.id}' GROUP BY action) a`);
  assert.equal(activity, 'approved:4,assigned:18,created:66,earned:3,rejected:2,voided:1');
  assert.equal(
    Number(
      query(`SELECT count(*) FROM crm_activity WHERE workspace_id='${workspace}'
    AND actor_id<>'${admin.user.id}'`),
    ),
    0,
  );
  const history = query(`SELECT string_agg(DISTINCT reason, ',') FROM crm_assignments
    WHERE workspace_id='${workspace}'`);
  assert.equal(history, 'created,handover,import,reassigned');

  const everything = await visible(admin, workspace);
  assert.equal(everything.scope, 'team');
  for (const [collection, count] of Object.entries(sampleCounts)) {
    assert.equal(everything.ids[collection].length, count, collection);
  }
  const marina = everything.records.Properties.find(
    (entry) => entry.record.property_id === 'PR-S01',
  );
  assert.equal(marina.record.contact_id, 'CT-S01');
  assert.match(marina.record.map_link, /^https:\/\/www\.google\.com\/maps\/search\/\?api=1&query=/);

  const accounts = {};
  for (const handle of ['sample.layla', 'sample.karim', 'sample.noura']) {
    const address = staffEmail(handle, email);
    assert.equal(first.staff[address]?.status, 'created');
    accounts[handle] = await signIn(address, first.staff[address].password);
  }
  const karim = await visible(accounts['sample.karim'], workspace);
  assert.equal(karim.scope, 'team');
  assert.deepEqual(karim.ids, everything.ids);
  const karimActions = accounts['sample.karim'].user.recordActions;
  // Deals reference clients, so deleting them also needs team finance (L-F2, Q9).
  assert.ok(!karimActions.Clients.delete && karimActions.Contacts.delete);
  assert.ok(!karimActions.Properties.delete);
  assert.deepEqual(accounts['sample.karim'].user.channelAccess, { email: true, whatsapp: true });

  const layla = await visible(accounts['sample.layla'], workspace);
  assert.equal(layla.scope, 'assigned');
  assert.deepEqual(layla.ids, {
    Clients: ids('CL', [2, 4, 9]),
    Contacts: ids('CT', [1, 2, 7]),
    Properties: ids('PR', [2, 3]),
    'Follow-ups': ids('FU', [2]),
    Viewings: ids('VW', [2, 4]),
    Shortlist: ids('MT', [2, 3]),
    'Interaction log': ids('LG', [4]),
    'Client care': [],
  });
  const laylaActions = accounts['sample.layla'].user.recordActions;
  assert.ok(
    laylaActions.Clients.create && laylaActions.Clients.edit && !laylaActions.Clients.delete,
  );

  const noura = await visible(accounts['sample.noura'], workspace);
  assert.deepEqual(noura.ids, {
    Clients: ids('CL', [3, 5]),
    Contacts: ids('CT', [8]),
    Properties: [],
    'Follow-ups': ids('FU', [3, 6]),
    Viewings: ids('VW', [3]),
    Shortlist: [],
    'Interaction log': [],
    'Client care': [],
  });
  for (const actions of Object.values(accounts['sample.noura'].user.recordActions)) {
    assert.deepEqual(actions, { create: false, edit: false, delete: false, assign: false });
  }

  const second = seed(email);
  assert.match(second.stdout, /Total\s+0 added,\s+52 already present/);
  assert.ok(Object.values(second.staff).every((member) => member.status === 'existing'));
  assert.ok(Object.values(second.staff).every((member) => member.password === undefined));
  assert.equal(sampleRows(workspace), 52);
  assert.equal(sql(`workspace_id='${workspace}'`), 52);
  assert.equal(
    Number(
      query(`SELECT count(*) FROM crm_sample_accounts
    WHERE workspace_id='${workspace}'`),
    ),
    3,
  );

  // Sample IDs sit outside the issued range, so the server keeps numbering from 001.
  const created = await admin.request(`/workspaces/${workspace}/records/Clients`, {
    method: 'POST',
    body: { record: { full_name: 'Typed by the Admin' } },
  });
  assert.equal(created.status, 201, JSON.stringify(created.value));
  assert.equal(created.value.record[idKeys.Clients], 'CL-001');
});
