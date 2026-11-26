import assert from 'node:assert/strict';
import { query } from './helpers.mjs';
import { recordPath } from './permission-helpers.mjs';
import { createDeal, heldClient } from './finance-deals-helpers.mjs';

/** The identical 409 for hidden, unknown, other-team and finance-less deal links. */
export const DEAL_LINK_MISSING = {
  message: 'The linked deal is missing from this workspace. Choose another deal or clear it.',
  code: 'link_missing',
};

const LOG = 'Interaction log';

/** `deal_ref` of one Interaction log, or '-' when unlinked. */
export const dealRef = (workspace, logId) =>
  query(
    `SELECT coalesce(deal_ref,'-') FROM crm_records WHERE workspace_id='${workspace}'
     AND collection='${LOG}' AND legacy_id='${logId}'`,
  );

export const postLog = (session, workspace, record) =>
  session.request(recordPath(workspace, LOG), { method: 'POST', body: { record } });

/** Creates an Interaction log for `clientId`, optionally linked to `deal`. */
export async function createLog(session, workspace, clientId, deal = '', extra = {}) {
  const record = { client_id: clientId, deal_id_optional: deal, ...extra };
  const result = await postLog(session, workspace, record);
  assert.equal(result.status, 201, JSON.stringify(result.value));
  return result.value;
}

export const patchLog = (session, workspace, entry, changes) =>
  session.request(recordPath(workspace, LOG, entry.id), {
    method: 'PATCH',
    body: { version: entry.version, record: { ...entry.record, ...changes } },
  });

/** The caller's records list for `workspace`. */
export async function records(session, workspace) {
  const result = await session.request(`/workspaces/${workspace}/records`);
  assert.equal(result.status, 200, JSON.stringify(result.value));
  return result.value;
}

export const dealLinks = async (session, workspace) =>
  (await records(session, workspace)).dealLinks;

export async function findLog(session, workspace, logId) {
  const entry = (await records(session, workspace)).records[LOG].find(
    (row) => row.record.log_id === logId,
  );
  assert.ok(entry, logId);
  return entry;
}

/** A pre-0016 style row: payload deal text with deal_ref NULL (grandfathered). */
export function insertLegacyLog(workspace, logId, clientId, dealValue) {
  const payload = JSON.stringify({
    log_id: logId,
    client_id: clientId,
    deal_id_optional: dealValue,
  });
  query(
    `INSERT INTO crm_records (id,workspace_id,collection,legacy_id,payload,client_ref)
     VALUES (gen_random_uuid(),'${workspace}','${LOG}','${logId}','${payload}'::jsonb,'${clientId}')`,
  );
}

/** Another team's deal whose ID (DL-006) no deal in `workspace` uses: IDs are per team. */
export async function foreignDeal(other, workspace) {
  const client = await heldClient(other);
  let deal;
  for (let count = 0; count < 6; count += 1) deal = await createDeal(other, client);
  const clash = `SELECT count(*) FROM crm_deals WHERE workspace_id='${workspace}'
    AND legacy_id='${deal.dealId}'`;
  assert.equal(query(clash), '0');
  return deal;
}
