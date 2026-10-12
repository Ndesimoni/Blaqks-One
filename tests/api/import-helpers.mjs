import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { login, query } from './helpers.mjs';

export const organisation = 'super-admin-workspace';
export const emptyRecords = () => ({ Clients: [], Contacts: [], Properties: [] });
export const zeroCounts = { Clients: 0, Contacts: 0, Properties: 0 };
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

export function preview(
  owner,
  workspace,
  records,
  sourceWorkspaceId = 'backup-personal',
  options = {},
) {
  return owner.request(importsPath(workspace, 'preview'), {
    method: 'POST',
    body: { sourceWorkspaceId, records },
    ...options,
  });
}

export function commit(owner, workspace, token, options = {}) {
  return owner.request(importsPath(workspace, 'commit'), {
    method: 'POST',
    body: { token },
    ...options,
  });
}

export async function planned(owner, workspace, records, sourceWorkspaceId) {
  const response = await preview(owner, workspace, records, sourceWorkspaceId);
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
