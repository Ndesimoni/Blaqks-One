import { login, query } from './helpers.mjs';
import { activate, invite } from './team-helpers.mjs';

/** Two fresh Admin teams keep referral fixtures out of shared fixture workspaces. */
export async function referralTeams(prefix) {
  query('TRUNCATE crm_login_limits');
  const owner = await login('owner');
  const teams = [];
  for (const suffix of ['a', 'b']) {
    const invited = await invite(owner, `${prefix}-${suffix}`, {
      accountRole: 'admin',
      positions: [],
    });
    teams.push(await activate(invited));
  }
  return { owner, admin: teams[0], other: teams[1] };
}

export const referralRef = (workspace, legacyId) =>
  query(
    `SELECT coalesce(referral_ref,'-') FROM crm_records WHERE workspace_id='${workspace}' AND legacy_id='${legacyId}'`,
  );

export const legacyCount = (workspace, legacyId) =>
  Number(
    query(
      `SELECT count(*) FROM crm_records WHERE workspace_id='${workspace}' AND legacy_id='${legacyId}'`,
    ),
  );
