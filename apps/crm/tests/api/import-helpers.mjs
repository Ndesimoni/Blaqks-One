import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { login, query } from './helpers.mjs';

export const organisation = 'super-admin-workspace';
export const collections = [
  'Clients',
  'Contacts',
  'Properties',
  'Follow-ups',
  'Viewings',
  'Shortlist',
  'Interaction log',
  'Client care',
];
export const emptyRecords = () => Object.fromEntries(collections.map((name) => [name, []]));
export const counts = (values = {}) =>
  Object.fromEntries(collections.map((name) => [name, values[name] || 0]));
export const zeroCounts = counts();
export const importsPath = (workspace, action) => `/workspaces/${workspace}/imports/${action}`;
export const tokenHash = (token) => createHash('sha256').update(token).digest('hex');

export async function fixtures() {
  query('TRUNCATE crm_login_limits');
  return {
    owner: await login('owner'),
    admin: await login('admin-a'),
    other: await login('admin-b'),
  };
}

/**
 * The company's owning Admin imports into their own workspace (BO1a). A personal source
 * names the member who receives the parent records: the importing Admin unless
 * `options.memberId` says otherwise (`null` sends none).
 */
export function preview(
  actor,
  workspace,
  records,
  sourceWorkspaceId = 'backup-personal',
  options = {},
) {
  const personal = sourceWorkspaceId !== organisation;
  const { memberId = personal ? actor.user.id : undefined, ...rest } = options;
  return actor.request(importsPath(workspace, 'preview'), {
    method: 'POST',
    body: { sourceWorkspaceId, ...(memberId === undefined ? {} : { memberId }), records },
    ...rest,
  });
}

export function commit(actor, workspace, token, options = {}) {
  return actor.request(importsPath(workspace, 'commit'), {
    method: 'POST',
    body: { token },
    ...options,
  });
}

export async function planned(actor, workspace, records, sourceWorkspaceId, options) {
  const response = await preview(actor, workspace, records, sourceWorkspaceId, options);
  assert.equal(response.status, 200, JSON.stringify(response.value));
  assert.match(response.value.token, /^[A-Za-z0-9_-]{43}$/);
  assert.ok(Date.parse(response.value.expiresAt) > Date.now());
  return response.value;
}

export function recordCount(workspace, legacyId) {
  return Number(
    query(
      `SELECT count(*) FROM crm_records WHERE workspace_id='${workspace}' AND legacy_id='${legacyId}'`,
    ),
  );
}

export function activityCount(workspace) {
  return Number(query(`SELECT count(*) FROM crm_activity WHERE workspace_id='${workspace}'`));
}
