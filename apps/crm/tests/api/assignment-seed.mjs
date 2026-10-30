/** Pre-0008 users, workspaces, records and activity for the M6 backfill checks. */
const uuid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const full = { relationships: true, properties: true, schedule: true };

export const ids = {
  sa: uuid(1),
  a: uuid(10),
  b: uuid(11),
  c: uuid(12), // suspended Admin: staff creators in C have an inactive owner
  d: uuid(13), // archived Admin: the whole workspace is archived
  eligible: uuid(21),
  archived: uuid(22),
  inactive: uuid(23),
  noGrant: uuid(24), // relationships only: no properties or schedule grant
  ownerInactive: uuid(25),
  otherTeam: uuid(26),
  archivedTeam: uuid(27),
  orgStaff: uuid(28),
};
export const org = 'super-admin-workspace';
const ws = { a: ids.a, b: ids.b, c: ids.c, d: ids.d, org };

const admins = [
  [ids.sa, 'super-admin', true, null],
  [ids.a, 'admin', true, null],
  [ids.b, 'admin', true, null],
  [ids.c, 'admin', false, null],
  [ids.d, 'admin', false, 'now()'],
];
const staff = [
  [ids.eligible, ids.a, ws.a, true, null, full],
  [ids.archived, ids.a, ws.a, false, 'now()', full],
  [ids.inactive, ids.a, ws.a, false, null, full],
  [ids.noGrant, ids.a, ws.a, true, null, { relationships: true }],
  [ids.ownerInactive, ids.c, ws.c, true, null, full],
  [ids.otherTeam, ids.b, ws.b, true, null, full],
  [ids.archivedTeam, ids.d, ws.d, false, 'now()', full],
  [ids.orgStaff, ids.sa, org, true, null, full],
];

// [legacy id, workspace, collection, creators (earliest first), expected assignee, extra]
export const records = [
  ['A-CL-STAFF', ws.a, 'Clients', [ids.eligible], ids.eligible],
  ['A-PR-STAFF', ws.a, 'Properties', [ids.eligible], ids.eligible],
  ['A-CT-STAFF', ws.a, 'Contacts', [ids.eligible], ids.eligible],
  ['A-FU-STAFF', ws.a, 'Follow-ups', [ids.eligible], ids.eligible],
  ['A-CL-FIRST', ws.a, 'Clients', [ids.eligible, ids.noGrant], ids.eligible],
  ['A-CL-ARCHIVED', ws.a, 'Clients', [ids.archived], ids.a],
  ['A-FU-ARCHIVED', ws.a, 'Follow-ups', [ids.archived], null],
  ['A-CL-INACTIVE', ws.a, 'Clients', [ids.inactive], ids.a],
  ['A-CL-GRANT', ws.a, 'Clients', [ids.noGrant], ids.noGrant],
  ['A-PR-NOGRANT', ws.a, 'Properties', [ids.noGrant], ids.a],
  ['A-FU-NOGRANT', ws.a, 'Follow-ups', [ids.noGrant], null],
  ['A-CL-ADMIN', ws.a, 'Clients', [ids.a], ids.a],
  ['A-FU-ADMIN', ws.a, 'Follow-ups', [ids.a], null],
  ['A-CL-IMPORT', ws.a, 'Clients', [ids.sa], ids.a],
  ['A-CL-NONE', ws.a, 'Clients', [], ids.a],
  ['A-CL-CROSS', ws.a, 'Clients', [ids.otherTeam], ids.a],
  ['A-CL-MISFILED', ws.a, 'Clients', [], ids.a, { activityIn: ws.b, actor: ids.eligible }],
  ['A-VW-CHILD', ws.a, 'Viewings', [ids.eligible], null, { client: 'A-CL-STAFF' }],
  ['A-LG-CHILD', ws.a, 'Interaction log', [ids.eligible], null, { client: 'A-CL-STAFF' }],
  ['A-CC-CHILD', ws.a, 'Client care', [ids.eligible], null],
  ['A-MT-CHILD', ws.a, 'Shortlist', [ids.eligible], null],
  ['C-CL-STAFF', ws.c, 'Clients', [ids.ownerInactive], ids.c],
  ['C-FU-STAFF', ws.c, 'Follow-ups', [ids.ownerInactive], null],
  ['D-CL-STAFF', ws.d, 'Clients', [ids.archivedTeam], ids.d],
  ['B-CL-STAFF', ws.b, 'Clients', [ids.otherTeam], ids.otherTeam],
  ['ORG-CL-STAFF', org, 'Clients', [ids.orgStaff], ids.orgStaff],
  ['ORG-PR-OWNER', org, 'Properties', [ids.sa], ids.sa],
].map(([legacy, workspace, collection, creators, expected, extra = {}], index) => ({
  id: uuid(100 + index),
  legacy,
  workspace,
  collection,
  creators,
  expected,
  ...extra,
}));

const text = (value) => (value === null ? 'NULL' : `'${value}'`);
const json = (value) => `'${JSON.stringify(value)}'::jsonb`;

export function seedSql() {
  const statements = admins.map(
    ([id, role, active, deleted]) =>
      `INSERT INTO crm_users (id,name,email,phone,password_hash,role,active,deleted_at)
       VALUES ('${id}','Seed ${role}','${id}@seed.test','+971500000000','x','${role}',${active},${deleted ?? 'NULL'})`,
  );
  statements.push(
    `INSERT INTO crm_workspaces (id,owner_id) VALUES ${Object.entries(ws)
      .map(([key, id]) => `('${id}','${ids[key === 'org' ? 'sa' : key]}')`)
      .join(',')}`,
  );
  for (const [id, owner, workspace, active, deleted, permissions] of staff) {
    statements.push(
      `INSERT INTO crm_users (id,name,email,phone,password_hash,role,active,deleted_at,
         owner_id,workspace_id,permissions)
       VALUES ('${id}','Seed staff','${id}@seed.test','+971500000000','x','staff',${active},
         ${deleted ?? 'NULL'},'${owner}','${workspace}',${json(permissions)})`,
    );
  }
  for (const record of records) {
    statements.push(
      `INSERT INTO crm_records (id,workspace_id,collection,legacy_id,payload,version,client_ref,
         created_at,updated_at)
       VALUES ('${record.id}','${record.workspace}','${record.collection}','${record.legacy}',
         ${json({ seeded: record.legacy })},3,${text(record.client ?? null)},
         '2020-01-01T00:00:00Z','2020-01-02T00:00:00Z')`,
    );
    const actors = record.actor ? [record.actor] : record.creators;
    actors.forEach((actor, order) =>
      statements.push(
        `INSERT INTO crm_activity (id,actor_id,workspace_id,action,collection,record_id,created_at)
         VALUES (gen_random_uuid(),'${actor}','${record.activityIn ?? record.workspace}','created',
           '${record.collection}','${record.id}','2020-01-01T00:00:0${order}Z')`,
      ),
    );
  }
  return statements.join(';\n');
}
