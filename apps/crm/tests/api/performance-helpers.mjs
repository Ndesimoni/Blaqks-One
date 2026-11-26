import { login, query } from './helpers.mjs';
import { activate, findMember, invite } from './team-helpers.mjs';
import { FINANCE, grant } from './permission-helpers.mjs';

export const PERFORMANCE_MESSAGES = {
  manage: 'Only your Admin can set targets.',
  denied: 'Access denied.',
  invalid: 'Provide a valid target.',
  month: 'Choose a valid month.',
  metric: 'Choose a valid target measure.',
  value: 'Enter a whole-number target within the allowed range.',
  member: 'Choose an active member of this team.',
  stale: 'This target changed. Reload before saving.',
};

export const targetsPath = (workspace, suffix = '') =>
  `/workspaces/${workspace}/performance/targets${suffix}`;

export const targetBody = (changes = {}) => ({
  month: '2026-10',
  memberId: null,
  metric: 'enquiries',
  value: 10,
  version: null,
  ...changes,
});

/**
 * A fresh Admin team: an own-finance agent, a lead manager without finance, a receptionist
 * without reports, a team-scope supervisor without finance and a team-finance accountant.
 */
export async function performanceTeams(prefix) {
  query('TRUNCATE crm_login_limits');
  const owner = await login('owner');
  const make = (by, suffix, overrides) => invite(by, `${prefix}-${suffix}`, overrides);
  const admin = await activate(await make(owner, 'admin', { accountRole: 'admin', positions: [] }));
  const other = await activate(await make(owner, 'other', { accountRole: 'admin', positions: [] }));
  const agent = await activate(await make(admin, 'agent', { positions: ['property-agent'] }));
  const lead = await activate(await make(admin, 'lead', { positions: ['lead-manager'] }));
  const desk = await activate(await make(admin, 'desk', { positions: ['receptionist'] }));
  const supervisor = await grant(
    admin,
    await activate(await make(admin, 'supervisor', { positions: ['team-supervisor'] })),
    { recordScope: 'team' },
  );
  const accountant = await activate(await make(admin, 'books', { positions: ['accountant'] }));
  const member = await findMember(admin, accountant.user.id);
  const actions = { ...member.actions, finance: FINANCE.all };
  const viewer = await grant(admin, accountant, { recordScope: 'team', actions });
  const workspace = admin.user.workspaceId;
  const put = (session, body, ws = workspace) =>
    session.request(targetsPath(ws), { method: 'PUT', body });
  const get = (session, month = '2026-10', ws = workspace) =>
    session.request(targetsPath(ws, `?month=${month}`));
  return { owner, admin, other, agent, lead, desk, supervisor, viewer, workspace, put, get };
}

/** Redacted target activity for one target row, oldest first. */
export const targetActivity = (id) =>
  query(
    `SELECT string_agg(action || ':' || collection, ',' ORDER BY created_at,id) FROM crm_activity
     WHERE record_id='${id}'`,
  );
