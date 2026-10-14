import assert from 'node:assert/strict';
import {
  activate,
  findMember,
  invite,
  memberUpdate,
  staffLogin,
  teamPath,
} from './team-helpers.mjs';
import { assignmentTeams } from './assignment-helpers.mjs';

export const MESSAGES = {
  create: "Your access doesn't include adding these records.",
  edit: "Your access doesn't include editing these records.",
  delete: 'Ask your Admin to delete this record.',
  assign: "Your access doesn't include handing on these records.",
  denied: 'Access denied.',
  teamOnly: 'Deleting clients, contacts or properties needs whole-team visibility.',
  staffOnly: 'Record actions apply to staff only.',
  followUpDelete:
    "Only the client's holder, the Admin or a full-team member can delete this follow-up.",
};

export const COLLECTIONS = [
  'Clients',
  'Contacts',
  'Properties',
  'Follow-ups',
  'Viewings',
  'Shortlist',
  'Interaction log',
  'Client care',
];
export const PARENTS = ['Clients', 'Contacts', 'Properties'];
export const ASSIGNABLE = ['Clients', 'Properties', 'Contacts', 'Follow-ups'];
export const MODULE = {
  Clients: 'relationships',
  Contacts: 'relationships',
  Properties: 'properties',
  Shortlist: 'properties',
};
export const moduleOf = (collection) => MODULE[collection] ?? 'schedule';

/** A complete actions object; `flags` maps module → {key: bool} overrides. */
export function actions(base = true, flags = {}) {
  const on = (module, keys) =>
    Object.fromEntries(keys.map((key) => [key, flags[module]?.[key] ?? base]));
  return {
    relationships: on('relationships', ['create', 'edit', 'assign', 'deleteMain']),
    properties: on('properties', ['create', 'edit', 'assign', 'deleteActivity', 'deleteMain']),
    schedule: on('schedule', ['create', 'edit', 'assign', 'deleteActivity']),
  };
}

/** Finance flags (finance-design §5.1): none, the position preset, and an Admin's. */
export const FINANCE = {
  none: { create: false, edit: false, assign: false, approve: false, teamView: false },
  preset: { create: true, edit: true, assign: true, approve: false, teamView: false },
  all: { create: true, edit: true, assign: true, approve: true, teamView: true },
};
export const withFinance = (value, finance) => ({ ...value, finance });

/** Preset actions for all three modules: everything except deleteMain. */
export const preset = () =>
  actions(true, { relationships: { deleteMain: false }, properties: { deleteMain: false } });

/** PATCHes a member's team entry and signs them in again (sessions are revoked). */
export async function grant(admin, staff, changes) {
  const member = await findMember(admin, staff.user.id);
  const result = await admin.request(teamPath(admin, member.id), {
    method: 'PATCH',
    body: memberUpdate(member, changes),
  });
  assert.equal(result.status, 200, JSON.stringify(result.value));
  return staffLogin(member.email);
}

/** An isolated Admin team with one staff member per action profile. */
export async function permissionTeams(prefix) {
  const teams = await assignmentTeams(prefix);
  const { admin } = teams;
  const member = async (suffix, positions, changes) => {
    const staff = await activate(await invite(admin, `${prefix}-${suffix}`, { positions }));
    return changes ? grant(admin, staff, changes) : staff;
  };
  const team = { recordScope: 'team' };
  return {
    ...teams,
    assigned: teams.one,
    teamDelete: await member('team-delete', ['property-agent'], { ...team, actions: actions() }),
    teamKeep: await member('team-keep', ['property-agent'], team),
    viewOnly: await member('view-only', ['property-agent'], { ...team, actions: actions(false) }),
    noModule: await member('no-module', ['accountant']),
  };
}

export const recordPath = (workspace, collection, id) =>
  `/workspaces/${workspace}/records/${encodeURIComponent(collection)}${id ? `/${id}` : ''}`;

/** Asserts an exact `forbidden` response with `message`. */
export function forbidden(result, message, label = '') {
  assert.equal(result.status, 403, `${label} ${JSON.stringify(result.value)}`);
  assert.deepEqual(result.value, { message, code: 'forbidden' }, label);
}

/** One linked record per connected collection, created by the Admin. */
export async function seedRecords(admin, prefix) {
  const add = async (collection, record) => {
    const result = await admin.request(recordPath(admin.user.workspaceId, collection), {
      method: 'POST',
      body: { record },
    });
    assert.equal(result.status, 201, JSON.stringify(result.value));
    return result.value;
  };
  const [ct, cl, pr] = [`${prefix}-CT`, `${prefix}-CL`, `${prefix}-PR`];
  const linked = { client_id: cl, property_id: pr };
  return {
    Contacts: await add('Contacts', { contact_id: ct, full_name: 'Synthetic contact' }),
    Clients: await add('Clients', { client_id: cl, full_name: 'Synthetic client' }),
    Properties: await add('Properties', { property_id: pr, contact_id: ct }),
    'Follow-ups': await add('Follow-ups', { activity_id: `${prefix}-FU`, client_id: cl }),
    Viewings: await add('Viewings', { viewing_id: `${prefix}-VW`, ...linked }),
    Shortlist: await add('Shortlist', { match_id: `${prefix}-MT`, ...linked }),
    'Interaction log': await add('Interaction log', { log_id: `${prefix}-LG`, client_id: cl }),
    'Client care': await add('Client care', { care_id: `${prefix}-CA`, client_id: cl }),
  };
}
