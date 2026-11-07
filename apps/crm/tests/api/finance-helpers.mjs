import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { login, query } from './helpers.mjs';
import { activate, invite } from './team-helpers.mjs';

export const FINANCE_MESSAGES = {
  needsTeam: 'Approving and team finance need whole-team visibility.',
  approveNeedsView: 'Approving finance records needs See team finance.',
  manage: 'Only your Admin can change finance settings.',
  denied: 'Access denied.',
  percent: 'Percentages must be between 0 and 100 with up to two decimals.',
  trn: 'Enter a 15-digit TRN.',
  overlap: 'This agreement overlaps another agreement for this agent.',
  started: 'Agreements that have started cannot be removed.',
  notStaff: 'Choose a staff member of this team.',
  earned: 'This agreement would apply to deals already earned.',
};

export const financePath = (session, path = '', workspace = session.user.workspaceId) =>
  `/workspaces/${workspace}/finance${path}`;

/** A fresh Admin team (plus a second Admin) with an own-view agent and a receptionist. */
export async function financeTeams(prefix) {
  query('TRUNCATE crm_login_limits');
  const owner = await login('owner');
  const admin = await activate(
    await invite(owner, `${prefix}-admin`, { accountRole: 'admin', positions: [] }),
  );
  const other = await activate(
    await invite(owner, `${prefix}-other`, { accountRole: 'admin', positions: [] }),
  );
  const agent = await activate(
    await invite(admin, `${prefix}-agent`, { positions: ['property-agent'] }),
  );
  const desk = await activate(
    await invite(admin, `${prefix}-desk`, { positions: ['receptionist'] }),
  );
  return { owner, admin, other, agent, desk };
}

/** The database error text for a statement that must fail in the test database. */
export function failure(sql) {
  const project = process.env.CRM_TEST_PROJECT;
  assert.ok(project?.startsWith('kws-crm-test-'), 'Database checks require a test project.');
  try {
    execFileSync(
      'docker',
      ['compose', '-f', 'compose.test.yaml', '-p', project, 'exec', '-T', 'postgres', 'psql']
        .concat(['-v', 'ON_ERROR_STOP=1', '-U', 'kws_crm_test', '-d', 'kws_crm_test'])
        .concat(['-tAc', sql]),
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
    );
  } catch (error) {
    return String(error.stderr);
  }
  throw Error(`Expected failure: ${sql}`);
}

/** Asserts an exact error body. */
export function refused(result, status, message, code, label = '') {
  assert.equal(result.status, status, `${label} ${JSON.stringify(result.value)}`);
  assert.deepEqual(result.value, { message, code }, label);
}

/** Finance history rows for one entity, oldest first, without IDs and timestamps. */
export const events = (entityId) =>
  JSON.parse(
    query(`SELECT COALESCE(jsonb_agg(jsonb_build_object('entity',entity,'action',action,
      'actor',actor_id,'changes',changes,'reason',reason,'source',source)
      ORDER BY created_at,id),'[]') FROM crm_finance_events WHERE entity_id='${entityId}'`),
  );

/** An ISO date `offset` days from today in Asia/Dubai, as the database sees it. */
export const day = (offset) =>
  query(`SELECT ((now() AT TIME ZONE 'Asia/Dubai')::date + ${Number(offset)})::text`);

export const settingsBody = (changes = {}) => ({
  version: null,
  agentShareBp: 5000,
  secondAgentSource: 'first_agent',
  maxReferralShareBp: 2000,
  vatRegistered: true,
  trn: '100123456700003',
  ...changes,
});
