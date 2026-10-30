/** Pre-0009 users for the action-grant backfill (action-permissions §3, §12 L-1, §13). */
const uuid = (n) => `00000000-0000-4000-9000-${String(n).padStart(12, '0')}`;
const full = { relationships: true, properties: true, schedule: true, finance: true };

export const org = 'super-admin-workspace';
export const admins = {
  sa: [uuid(1), 'super-admin', true, null, org],
  a: [uuid(10), 'admin', true, null, uuid(10)],
  c: [uuid(12), 'admin', false, null, uuid(12)], // suspended Admin
  d: [uuid(13), 'admin', false, 'now()', uuid(13)], // archived Admin and team
};

// name: [owner, active, accepted, archived, scope, permissions]
export const staff = {
  teamFull: ['a', true, true, false, 'team', full],
  teamNoSchedule: ['a', true, true, false, 'team', { relationships: true, properties: true }],
  teamRelOnly: ['a', true, true, false, 'team', { relationships: true }],
  teamPropSchedule: ['a', true, true, false, 'team', { properties: true, schedule: true }],
  teamFalseValues: ['a', true, true, false, 'team', { ...full, relationships: false }],
  assignedFull: ['a', true, true, false, 'assigned', full],
  pending: ['a', false, false, false, 'assigned', { relationships: true, schedule: true }],
  suspended: ['a', false, true, false, 'team', full],
  suspendedAdminStaff: ['c', true, true, false, 'team', full],
  missingKeys: ['a', true, true, false, 'team', {}],
  orgStaff: ['sa', true, true, false, 'team', full],
  archived: ['a', false, true, true, 'team', full],
  archivedTeam: ['d', false, true, true, 'team', full],
};
export const ids = Object.fromEntries(
  [...Object.keys(admins), ...Object.keys(staff)].map((name, index) => [
    name,
    admins[name]?.[0] ?? uuid(100 + index),
  ]),
);

const json = (value) => `'${JSON.stringify(value)}'::jsonb`;

export function seedSql() {
  const statements = Object.values(admins).map(
    ([id, role, active, deleted]) =>
      `INSERT INTO crm_users (id,name,email,phone,password_hash,role,active,deleted_at,permissions)
       VALUES ('${id}','Seed ${role}','${id}@seed.test','+971500000000','x','${role}',${active},
         ${deleted ?? 'NULL'},${json(role === 'admin' ? {} : full)})`,
  );
  statements.push(
    `INSERT INTO crm_workspaces (id,owner_id) VALUES ${Object.values(admins)
      .map(([id, , , , workspace]) => `('${workspace}','${id}')`)
      .join(',')}`,
  );
  for (const [name, [owner, active, accepted, archived, scope, permissions]] of Object.entries(
    staff,
  )) {
    const [ownerId, , , , workspace] = admins[owner];
    statements.push(
      `INSERT INTO crm_users (id,name,email,phone,password_hash,role,active,deleted_at,owner_id,
         workspace_id,permissions,record_scope,accepted_at)
       VALUES ('${ids[name]}','Seed ${name}','${ids[name]}@seed.test','+971500000000','x','staff',
         ${active},${archived ? 'now()' : 'NULL'},'${ownerId}','${workspace}',${json(permissions)},
         '${scope}',${accepted ? 'now()' : 'NULL'})`,
    );
  }
  statements.push(
    `INSERT INTO crm_sessions (token_hash,user_id,csrf_token,expires_at)
     VALUES ('seed-session','${ids.teamFull}','csrf',now()+interval '1 hour')`,
  );
  return statements.join(';\n');
}
