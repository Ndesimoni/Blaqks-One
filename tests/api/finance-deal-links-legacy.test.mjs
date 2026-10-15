import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { query } from './helpers.mjs';
import { failure } from './finance-helpers.mjs';
import { commit, counts, emptyRecords, planned } from './import-helpers.mjs';
import { createDeal, dealTeams, heldClient } from './finance-deals-helpers.mjs';
import {
  DEAL_LINK_MISSING as MISSING,
  createLog,
  dealLinks,
  dealRef,
  findLog,
  foreignDeal,
  insertLegacyLog,
  patchLog,
} from './finance-deal-links-helpers.mjs';

// Grandfathered values (payload text, deal_ref NULL) and imports (finance-design L-F7).
let t, ws, adminClient, agentClient, adminDeal, otherDeal;
before(async () => {
  t = await dealTeams('deal-legacy');
  ws = t.admin.user.id;
  adminClient = await heldClient(t.admin);
  agentClient = await heldClient(t.agent);
  adminDeal = await createDeal(t.admin, adminClient);
  otherDeal = await foreignDeal(t.other, ws);
});

test('legacy deal text stays unlinked and is never resolved by matching', async () => {
  insertLegacyLog(ws, 'DLG-GONE', adminClient, 'DL-GONE');
  insertLegacyLog(ws, 'DLG-MATCH', adminClient, adminDeal.dealId);
  insertLegacyLog(ws, 'DLG-HIDDEN', agentClient, adminDeal.dealId);
  for (const id of ['DLG-GONE', 'DLG-MATCH', 'DLG-HIDDEN']) assert.equal(dealRef(ws, id), '-');
  const legacy = ['DLG-GONE', 'DLG-MATCH', 'DLG-HIDDEN'];
  const listed = (await dealLinks(t.admin, ws)).filter((link) => legacy.includes(link.log_id));
  assert.deepEqual(listed, []);
  const gone = await findLog(t.admin, ws, 'DLG-GONE');
  assert.equal(gone.record.deal_id_optional, 'DL-GONE');
  assert.equal(gone.version, 1);
});

test('the next save must clear a dangling value or choose a visible deal', async () => {
  const gone = await findLog(t.admin, ws, 'DLG-GONE');
  const untouched = await patchLog(t.admin, ws, gone, { conversation_topic: 'Edited' });
  assert.equal(untouched.status, 409);
  assert.deepEqual(untouched.value, MISSING);
  assert.equal((await findLog(t.admin, ws, 'DLG-GONE')).version, 1);
  const cleared = await patchLog(t.admin, ws, gone, { deal_id_optional: '' });
  assert.equal(cleared.status, 200, JSON.stringify(cleared.value));
  assert.equal(dealRef(ws, 'DLG-GONE'), '-');
  // Saving the same text is an explicit link request, checked under the saver's access.
  const hidden = await findLog(t.agent, ws, 'DLG-HIDDEN');
  const refused = await patchLog(t.agent, ws, hidden, { conversation_topic: 'Agent edit' });
  assert.equal(refused.status, 409);
  assert.deepEqual(refused.value, MISSING);
  assert.equal(dealRef(ws, 'DLG-HIDDEN'), '-');
  const match = await findLog(t.admin, ws, 'DLG-MATCH');
  const linked = await patchLog(t.admin, ws, match, { conversation_topic: 'Admin edit' });
  assert.equal(linked.status, 200, JSON.stringify(linked.value));
  assert.equal(dealRef(ws, 'DLG-MATCH'), adminDeal.dealId);
});

test('imports keep deal text but always leave deal_ref NULL', async () => {
  const records = {
    ...emptyRecords(),
    Clients: [{ client_id: 'DLI-CLIENT', full_name: 'Imported client' }],
    'Interaction log': [
      { log_id: 'DLI-LOG-1', client_id: 'DLI-CLIENT', deal_id_optional: adminDeal.dealId },
      { log_id: 'DLI-LOG-2', client_id: 'DLI-CLIENT', deal_id_optional: 'DL-NOWHERE' },
      { log_id: 'DLI-LOG-3', client_id: 'DLI-CLIENT', deal_id_optional: otherDeal.dealId },
    ],
  };
  const plan = await planned(t.owner, ws, records);
  const result = await commit(t.owner, ws, plan.token);
  assert.equal(result.status, 200, JSON.stringify(result.value));
  assert.deepEqual(result.value.imported, counts({ Clients: 1, 'Interaction log': 3 }));
  for (const id of ['DLI-LOG-1', 'DLI-LOG-2', 'DLI-LOG-3']) assert.equal(dealRef(ws, id), '-');
  const imported = await findLog(t.admin, ws, 'DLI-LOG-1');
  assert.equal(imported.record.deal_id_optional, adminDeal.dealId);
  const links = await dealLinks(t.admin, ws);
  assert.ok(links.every((link) => !link.log_id.startsWith('DLI-')));
});

test('the database keeps deal links same-workspace, log-only and equal to the payload', async () => {
  const log = await createLog(t.admin, ws, adminClient, adminDeal.dealId);
  const id = log.record.log_id;
  const where = `workspace_id='${ws}' AND legacy_id`;
  assert.match(
    failure(
      `UPDATE crm_records SET deal_ref='${adminDeal.dealId}' WHERE ${where}='${adminClient}'`,
    ),
    /crm_records_deal_scope/,
  );
  assert.match(
    failure(`UPDATE crm_records SET deal_ref='DL-GONE' WHERE ${where}='${id}'`),
    /crm_records_deal_payload/,
  );
  const foreign = `jsonb_set(payload,'{deal_id_optional}','"${otherDeal.dealId}"')`;
  assert.match(
    failure(`UPDATE crm_records SET payload=${foreign},deal_ref='${otherDeal.dealId}'
      WHERE ${where}='${id}'`),
    /crm_records_deal_link/,
  );
  assert.equal(
    query(`SELECT count(*) FROM crm_records WHERE deal_ref IS NOT NULL
      AND collection<>'Interaction log'`),
    '0',
  );
});
