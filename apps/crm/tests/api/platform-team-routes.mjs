// BO1b: every platform route with the area and level it needs (reads View, writes Manage),
// and the company data no platform member ever reaches.
import assert from 'node:assert/strict';
import { ORGANISATION } from './platform-team-helpers.mjs';

const RANK = { view: 1, manage: 2 };
const STALE = 999_999;

export const refused = (status) => status === 403 || status === 404;

/**
 * Every platform route for one company, as `[area, level, method, path, body]`. A caller
 * holding the level gets past the guard (a 200, or a 409 for the deliberately stale
 * versions); everyone else is refused.
 */
export function platformRoutes(company) {
  const workspace = company.user.workspaceId;
  const members = `/platform/companies/${workspace}/members`;
  const organisation = `/workspaces/${ORGANISATION}`;
  return [
    ['dashboard', 'view', 'GET', '/platform/metrics'],
    ['companies', 'view', 'GET', '/platform/companies'],
    ['companies', 'view', 'GET', members],
    [
      'companies',
      'manage',
      'PUT',
      `${members}/${company.user.id}/active`,
      { version: STALE, active: true },
    ],
    [
      'companies',
      'manage',
      'PUT',
      `/workspaces/${workspace}/company/seat-limit`,
      { version: STALE, memberLimit: 3 },
    ],
    ['companies', 'manage', 'GET', `${organisation}/team/${company.user.id}/archive-preview`],
    ['invite_admins', 'manage', 'GET', `${organisation}/team`],
    ['marketplace', 'view', 'GET', `${organisation}/marketplace/applications?state=all`],
    [
      'marketplace',
      'manage',
      'POST',
      `/workspaces/${workspace}/marketplace/decision`,
      {
        applicationId: '00000000-0000-4000-8000-000000000001',
        decision: 'revoked',
        reason: 'Synthetic level check',
      },
    ],
    ['platform_website', 'view', 'GET', '/platform/websites/general'],
    ['platform_website', 'view', 'GET', '/platform/websites/general/draft'],
    ['platform_website', 'view', 'GET', '/platform/websites/companies'],
    [
      'platform_website',
      'manage',
      'PUT',
      `/platform/websites/companies/${workspace}/eligibility`,
      { version: STALE, entitled: false, licenceVerified: false },
    ],
  ];
}

/** Company data and the organisation's CRM: refused to every platform member. */
export function companyData(company) {
  const workspace = company.user.workspaceId;
  const paths = ['/records', '/finance', '/activity', '/team', '/assignees?collection=Clients'];
  const own = ['/records', '/activity', '/chat', '/mailbox', '/inbox/conversations', '/agreements'];
  return [
    ...paths.map((path) => `/workspaces/${workspace}${path}`),
    ...own.map((path) => `/workspaces/${ORGANISATION}${path}`),
  ];
}

/** Checks each platform route against the member's `{area: level}` access. */
export async function expectAccess(session, company, access) {
  for (const [area, level, method, path, body] of platformRoutes(company)) {
    const { status, value } = await session.request(path, { method, body });
    const label = `${area}:${level} ${method} ${path}: ${status} ${JSON.stringify(value)}`;
    if ((RANK[access[area]] || 0) >= RANK[level]) assert.ok([200, 409].includes(status), label);
    else assert.ok(refused(status), label);
  }
  for (const path of companyData(company)) {
    const { status } = await session.request(path);
    assert.ok(refused(status), `${path}: ${status}`);
  }
}
