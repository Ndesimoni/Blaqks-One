import assert from 'node:assert/strict';
import { login, query } from './helpers.mjs';
import {
  activate,
  findMember,
  invite,
  memberUpdate,
  staffLogin,
  teamPath,
} from './team-helpers.mjs';

/**
 * A fresh Admin team with two assigned-only agents, plus a second Admin team, so
 * visibility fixtures never depend on records other suites leave in shared workspaces.
 */
export async function assignmentTeams(prefix, positions = ['property-agent']) {
  query('TRUNCATE crm_login_limits');
  const owner = await login('owner');
  const admins = [];
  for (const suffix of ['admin', 'other']) {
    const invited = await invite(owner, `${prefix}-${suffix}`, {
      accountRole: 'admin',
      positions: [],
    });
    admins.push(await activate(invited));
  }
  const [admin, other] = admins;
  const agents = [];
  for (const suffix of ['one', 'two']) {
    agents.push(await activate(await invite(admin, `${prefix}-${suffix}`, { positions })));
  }
  return { owner, admin, other, one: agents[0], two: agents[1] };
}

export const workspacePath = (session, collection, id, workspace = session.user.workspaceId) =>
  `/workspaces/${workspace}/records${collection ? `/${collection}` : ''}${id ? `/${id}` : ''}`;

export async function add(session, collection, record) {
  const result = await session.request(workspacePath(session, collection), {
    method: 'POST',
    body: { record },
  });
  assert.equal(result.status, 201, JSON.stringify(result.value));
  return result.value;
}

export const patch = (session, collection, entry, record, version = entry.version) =>
  session.request(workspacePath(session, collection, entry.id), {
    method: 'PATCH',
    body: { version, record },
  });

export const remove = (session, collection, id, version = 1) =>
  session.request(workspacePath(session, collection, id), {
    method: 'DELETE',
    body: { version },
  });

export const list = async (session) => {
  const result = await session.request(workspacePath(session));
  assert.equal(result.status, 200, JSON.stringify(result.value));
  return result.value;
};

/** Simulates a committed reassignment (the assignment API arrives in B3). */
export const setAssignee = (recordId, userId) =>
  query(
    `UPDATE crm_records SET assignee_id=${userId ? `'${userId}'` : 'NULL'} WHERE id='${recordId}'`,
  );

export const assigneeOf = (recordId) =>
  query(`SELECT coalesce(assignee_id::text,'-') FROM crm_records WHERE id='${recordId}'`);

export const history = (recordId) =>
  query(
    `SELECT string_agg(reason || ':' || coalesce(to_id::text,'-') || ':' ||
       coalesce(actor_id::text,'-'), ',' ORDER BY created_at) FROM crm_assignments
     WHERE record_id='${recordId}'`,
  );

/** Grants or removes full-team access, then signs the member in again. */
export async function setScope(admin, staff, recordScope) {
  const member = await findMember(admin, staff.user.id);
  const result = await admin.request(teamPath(admin, member.id), {
    method: 'PATCH',
    body: memberUpdate(member, { recordScope }),
  });
  assert.equal(result.status, 200, JSON.stringify(result.value));
  return staffLogin(member.email);
}
