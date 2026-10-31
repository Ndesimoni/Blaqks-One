import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import {
  ASSIGNABLE,
  COLLECTIONS,
  MESSAGES,
  PARENTS,
  actions,
  forbidden,
  moduleOf,
  permissionTeams,
  preset,
  recordPath,
  seedRecords,
} from './permission-helpers.mjs';

let teams, records, workspace;
const none = actions(false);
// Each caller's expected grants: `full` by role, otherwise staff actions and scope.
const profiles = {
  admin: { full: true },
  owner: { full: true },
  assigned: { actions: preset(), team: false },
  teamDelete: { actions: actions(), team: true },
  teamKeep: { actions: preset(), team: true },
  viewOnly: { actions: none, team: true },
  noModule: { modules: false },
  other: { workspace: false },
};

before(async () => {
  teams = await permissionTeams('perm-matrix');
  workspace = teams.admin.user.workspaceId;
  records = await seedRecords(teams.admin, 'MX');
});

function allowed(profile, collection, action) {
  if (profile.full) return action !== 'assign' || ASSIGNABLE.includes(collection);
  if (profile.modules === false || profile.workspace === false) return false;
  const flags = profile.actions[moduleOf(collection)];
  if (action === 'assign') return ASSIGNABLE.includes(collection) && flags.assign;
  if (action !== 'delete') return flags[action];
  return PARENTS.includes(collection) ? profile.team && flags.deleteMain : flags.deleteActivity;
}

/** Invalid bodies: a permitted caller gets the 400, any other caller the 403 first. */
const operations = {
  create: (session, collection) =>
    session.request(recordPath(workspace, collection), { method: 'POST', body: {} }),
  edit: (session, collection) =>
    session.request(recordPath(workspace, collection, records[collection].id), {
      method: 'PATCH',
      body: {},
    }),
  delete: (session, collection) =>
    session.request(recordPath(workspace, collection, records[collection].id), {
      method: 'DELETE',
      body: { version: 0 },
    }),
  assign: (session, collection) =>
    session.request(`${recordPath(workspace, collection, records[collection].id)}/assignee`, {
      method: 'PUT',
      body: { version: 0, assigneeId: null },
    }),
};

function expected(profile, collection, action) {
  if (profile.workspace === false || profile.modules === false) return MESSAGES.denied;
  // Path-only 400s (I-1) and the Follow-ups return exemption (M-A) precede the 403.
  if (action === 'assign' && !ASSIGNABLE.includes(collection)) return 400;
  if (action === 'assign' && collection === 'Follow-ups') return 400;
  return allowed(profile, collection, action) ? 400 : MESSAGES[action];
}

test('every caller × collection × action returns the grant-dependent 403 before any 400', async () => {
  for (const [name, profile] of Object.entries(profiles)) {
    for (const collection of COLLECTIONS) {
      for (const [action, run] of Object.entries(operations)) {
        const label = `${name} ${action} ${collection}`;
        const result = await run(teams[name], collection);
        const outcome = expected(profile, collection, action);
        if (outcome === 400) assert.equal(result.status, 400, `${label} ${result.value?.message}`);
        else forbidden(result, outcome, label);
      }
    }
  }
});

test('recordActions in every profile match the enforced matrix', async () => {
  for (const [name, profile] of Object.entries(profiles)) {
    if (profile.workspace === false) continue;
    const session = await teams[name].request('/auth/session');
    assert.equal(session.status, 200);
    const { recordActions } = session.value.user;
    assert.deepEqual(Object.keys(recordActions).sort(), [...COLLECTIONS].sort(), name);
    for (const collection of COLLECTIONS) {
      const want = Object.fromEntries(
        ['create', 'edit', 'delete', 'assign'].map((action) => [
          action,
          allowed(profile, collection, action),
        ]),
      );
      assert.deepEqual(recordActions[collection], want, `${name} ${collection}`);
    }
  }
});

test('bulk moves need team scope, then Assign, before the body is read', async () => {
  const bulk = (session, body) =>
    session.request(`/workspaces/${workspace}/assignments/bulk`, { method: 'POST', body });
  const outcomes = {
    admin: 400,
    owner: 400,
    teamDelete: 400,
    teamKeep: 400,
    viewOnly: MESSAGES.assign,
    assigned: MESSAGES.denied,
    noModule: MESSAGES.denied,
    other: MESSAGES.denied,
  };
  for (const [name, outcome] of Object.entries(outcomes)) {
    const result = await bulk(teams[name], { toId: null, records: [] });
    if (outcome === 400) {
      assert.equal(result.status, 400, name);
      continue;
    }
    forbidden(result, outcome, name);
    forbidden(await bulk(teams[name], 'not an object'), outcome, `${name} malformed`);
  }
});
