import assert from 'node:assert/strict';
import { query } from './helpers.mjs';
import { activate, findMember, invite } from './team-helpers.mjs';
import { FINANCE, grant } from './permission-helpers.mjs';
import { financePath, financeTeams, settingsBody } from './finance-helpers.mjs';

export const DEAL_MESSAGES = {
  missing: { message: 'Record not found.', code: 'not_found' },
  create: "Your access doesn't include adding these records.",
  edit: "Your access doesn't include editing these records.",
  assign: "Your access doesn't include handing on these records.",
  approve: "Your access doesn't include approving finance records.",
  manage: 'Only your Admin can change finance settings.',
  denied: 'Access denied.',
  issued: 'Record IDs are issued by the server.',
  splitPanel: 'Change the split from the split panel.',
  money: 'Amounts must be whole fils between 0 and AED 10,000,000,000.',
  client: 'The linked client is missing from this workspace. Choose another client.',
  property:
    'The linked property is missing from this workspace. Choose another property or clear it.',
  stale: 'This deal changed. Reload before saving.',
  noSettings: "Set up your team's commission split before marking deals earned.",
  future: 'The earned date cannot be in the future.',
  own: 'Another approver must review your own submissions.',
  range:
    'Only your Admin can set an earned date more than 31 days ago or before the deal was created.',
  already: 'This deal is already earned.',
  lost: 'Lost or cancelled deals cannot be earned.',
  revise: 'Revise the deal to change its split.',
  locked: 'Earned deals can only be changed by your Admin.',
  unearnFirst: 'Unearn this deal before marking it lost or cancelled.',
  notEarned: 'Only earned deals can be revised or unearned.',
  everEarned: 'Only deals that were never earned can be deleted.',
  ineligible: 'Choose an active team member with finance access.',
  reason: 'A reason of 1 to 500 characters is required.',
  holderOnly: "Only the deal's holder can hand it over. Ask your Admin to move it.",
  cap: "The referral share is above your team's limit.",
  notPending: 'This hand-over is no longer pending.',
  secondGone: 'The second agent can no longer receive commission. Update the split first.',
  earnedAgreement: 'This agreement would apply to deals already earned.',
};

export const UNKNOWN = '00000000-0000-4000-8000-000000000000';

export const dealPath = (session, suffix = '') => financePath(session, `/deals${suffix}`);

export const dealBody = (clientId, changes = {}) => ({
  clientId,
  dealType: 'Sale',
  stage: 'Offer',
  agreedValueFils: 245_000_000,
  feeBasis: 'percentage',
  feeRateBp: 200,
  details: { notes: 'Synthetic deal' },
  ...changes,
});

/** Creates a client held by `session` (staff hold what they create). */
export async function heldClient(session, workspace = session.user.workspaceId) {
  const result = await session.request(`/workspaces/${workspace}/records/Clients`, {
    method: 'POST',
    body: { record: { full_name: 'Synthetic finance client' } },
  });
  assert.equal(result.status, 201, JSON.stringify(result.value));
  return result.value.record.client_id;
}

export async function createDeal(session, clientId, changes = {}, admin = session) {
  const result = await session.request(dealPath(admin), {
    method: 'POST',
    body: { deal: dealBody(clientId, changes) },
  });
  assert.equal(result.status, 201, JSON.stringify(result.value));
  return result.value.deal;
}

export const post = (session, admin, id, action, body) =>
  session.request(dealPath(admin, `/${id}/${action}`), { method: 'POST', body });

export const overview = async (session, admin = session, suffix = '') => {
  const result = await session.request(financePath(admin, suffix));
  assert.equal(result.status, 200, JSON.stringify(result.value));
  return result.value;
};

/** A team with settings, two own-view agents, an approver and a team viewer. */
export async function dealTeams(prefix, settings = {}) {
  const teams = await financeTeams(prefix);
  const { admin } = teams;
  const saved = await admin.request(financePath(admin, '/settings'), {
    method: 'PUT',
    body: settingsBody({ agentShareBp: 5000, vatRegistered: true, ...settings }),
  });
  assert.equal(saved.status, 200, JSON.stringify(saved.value));
  const staff = async (suffix, positions, flags) => {
    const invited = await activate(await invite(admin, `${prefix}-${suffix}`, { positions }));
    if (!flags) return invited;
    const member = await findMember(admin, invited.user.id);
    const actions = { ...member.actions, finance: flags };
    return grant(admin, invited, { recordScope: 'team', actions });
  };
  return {
    ...teams,
    second: await staff('second', ['property-agent']),
    approver: await staff('approver', ['accountant'], FINANCE.all),
    viewer: await staff('viewer', ['property-agent'], { ...FINANCE.preset, teamView: true }),
  };
}

/** Earns a deal as the Admin on `earnedOn` (defaults to today). */
export async function earnDeal(admin, deal, earnedOn) {
  const on = earnedOn ?? query(`SELECT ((now() AT TIME ZONE 'Asia/Dubai')::date)::text`);
  const result = await post(admin, admin, deal.id, 'earn', { version: deal.version, earnedOn: on });
  assert.equal(result.status, 200, JSON.stringify(result.value));
  return result.value.deal;
}

export const sortedKeys = (value) => Object.keys(value).sort();
