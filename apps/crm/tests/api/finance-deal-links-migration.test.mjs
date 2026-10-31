import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { seededDatabase } from './assignment-db.mjs';

// A disposable database migrated through 0015, seeded with Interaction logs whose deal
// text matches a deal, another team's deal, nothing or a non-string, then given 0016.
const db = seededDatabase('kws_deal_links_0015', '0016');
const uuid = (n) => `00000000-0000-4000-9100-${String(n).padStart(12, '0')}`;
const [a, b] = [uuid(1), uuid(2)];
const logs = {
  'LOG-MATCH': 'DL-0001',
  'LOG-FOREIGN': 'DL-0002',
  'LOG-GONE': 'DL-GONE',
  'LOG-BLANK': ' ',
  'LOG-NUMBER': 7,
};
const rows = () =>
  db.query(`SELECT string_agg(legacy_id||'|'||payload::text||'|'||version||'|'||updated_at
    ,';' ORDER BY legacy_id) FROM crm_records`);
let beforeRows;

function seedSql() {
  const users = [a, b].map(
    (id) => `INSERT INTO crm_users (id,name,email,phone,password_hash,role,active,permissions)
      VALUES ('${id}','Seed admin','${id}@seed.test','+971500000000','x','admin',true,'{}')`,
  );
  const workspaces = `INSERT INTO crm_workspaces (id,owner_id) VALUES ('${a}','${a}'),('${b}','${b}')`;
  const record = (ws, collection, id, payload, client = null) =>
    `INSERT INTO crm_records (id,workspace_id,collection,legacy_id,payload,client_ref)
     VALUES (gen_random_uuid(),'${ws}','${collection}','${id}','${JSON.stringify(payload)}'::jsonb,
     ${client ? `'${client}'` : 'NULL'})`;
  const deal = (ws, id) =>
    `INSERT INTO crm_deals (id,workspace_id,legacy_id,client_ref,deal_type,stage,fee_basis,
       fee_rate_bp,created_by) VALUES (gen_random_uuid(),'${ws}','${id}','CL-SEED','Sale','Offer',
       'percentage',200,'${ws}')`;
  const entries = Object.entries(logs).map(([id, value]) =>
    record(
      a,
      'Interaction log',
      id,
      { log_id: id, client_id: 'CL-SEED', deal_id_optional: value },
      'CL-SEED',
    ),
  );
  return [
    ...users,
    workspaces,
    record(a, 'Clients', 'CL-SEED', { client_id: 'CL-SEED' }),
    record(b, 'Clients', 'CL-SEED', { client_id: 'CL-SEED' }),
    deal(a, 'DL-0001'),
    deal(b, 'DL-0002'),
    ...entries,
  ].join(';\n');
}

before(() => {
  db.create();
  db.query(seedSql());
  beforeRows = rows();
  db.migrate('0016_interaction_deal_links.sql');
});
after(db.drop);

test('0016 links nothing and leaves every existing record untouched', () => {
  const afterRows = rows();
  assert.equal(afterRows, beforeRows);
  assert.equal(db.query(`SELECT count(*) FROM crm_records WHERE deal_ref IS NOT NULL`), '0');
  assert.match(afterRows, /LOG-MATCH\|[^|]*"deal_id_optional": "DL-0001"[^|]*\|1\|/);
});

test('0016 constraints refuse cross-workspace, non-log and mismatched links', () => {
  const set = (ref, id = 'LOG-MATCH', ws = a) =>
    `UPDATE crm_records SET deal_ref='${ref}' WHERE workspace_id='${ws}' AND legacy_id='${id}'`;
  assert.match(db.failure(set('DL-0001', 'LOG-FOREIGN')), /crm_records_deal_payload/);
  assert.match(
    db.failure(`UPDATE crm_records SET payload=payload||'{"deal_id_optional":"DL-0002"}',
      deal_ref='DL-0002' WHERE workspace_id='${a}' AND legacy_id='LOG-FOREIGN'`),
    /crm_records_deal_link/,
  );
  assert.match(db.failure(set('DL-0001', 'CL-SEED')), /crm_records_deal_scope/);
  db.query(set('DL-0001'));
  assert.match(
    db.failure(`DELETE FROM crm_deals WHERE workspace_id='${a}' AND legacy_id='DL-0001'`),
    /crm_records_deal_link/,
  );
  db.query(`UPDATE crm_records SET deal_ref=NULL WHERE legacy_id='LOG-MATCH'`);
  db.query(`DELETE FROM crm_deals WHERE workspace_id='${a}' AND legacy_id='DL-0001'`);
  const index = db.query(
    `SELECT indexdef FROM pg_indexes WHERE indexname='crm_records_deal_links'`,
  );
  assert.match(index, /\(workspace_id, deal_ref\) WHERE \(deal_ref IS NOT NULL\)/);
});
