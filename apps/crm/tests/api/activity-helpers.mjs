import assert from 'node:assert/strict';
import { query } from './helpers.mjs';
import { activate, invite } from './team-helpers.mjs';
import { grant } from './permission-helpers.mjs';
import { createDeal, dealTeams, heldClient } from './finance-deals-helpers.mjs';

export const activityPath = (workspace, params = {}) => {
  const search = new URLSearchParams(params).toString();
  return `/workspaces/${workspace}/activity${search ? `?${search}` : ''}`;
};

/** `GET activity` that must succeed; returns `{activity, nextCursor}`. */
export async function feed(session, workspace, params = {}) {
  const result = await session.request(activityPath(workspace, params));
  assert.equal(result.status, 200, JSON.stringify(result.value));
  assert.deepEqual(Object.keys(result.value).sort(), ['activity', 'nextCursor']);
  return result.value;
}

/** Every page of a filtered feed, following `nextCursor`. */
export async function allPages(session, workspace, params = {}) {
  const pages = [];
  let cursor;
  do {
    const page = await feed(session, workspace, { ...params, ...(cursor ? { cursor } : {}) });
    pages.push(page.activity);
    cursor = page.nextCursor;
  } while (cursor && pages.length < 50);
  return pages;
}

/** A fresh team with finance settings plus a team-scope agent without team finance. */
export async function activityTeams(prefix) {
  const teams = await dealTeams(prefix);
  const scoped = await activate(
    await invite(teams.admin, `${prefix}-scoped`, { positions: ['property-agent'] }),
  );
  const teamAgent = await grant(teams.admin, scoped, { recordScope: 'team' });
  return { ...teams, teamAgent, workspace: teams.admin.user.workspaceId };
}

/** A client held by `session`, plus a deal on it that `session` holds. */
export async function clientWithDeal(session, admin) {
  const clientId = await heldClient(session);
  return createDeal(session, clientId, {}, admin);
}

/** Inserts `count` activity rows sharing one timestamp, as a same-instant burst. */
export function burst(workspace, actor, record, count) {
  const values = Array.from(
    { length: count },
    () =>
      `(gen_random_uuid(),'${actor}','${workspace}','updated','Clients','${record}',` +
      `timestamptz '2026-01-15 08:00:00+00')`,
  ).join(',');
  query(
    'INSERT INTO crm_activity (id,actor_id,workspace_id,action,collection,record_id,created_at) ' +
      `VALUES ${values}`,
  );
}

/** Keys allowed on an item; anything else would be a leak. */
export const ITEM_KEYS = [
  'action',
  'actor',
  'at',
  'collection',
  'id',
  'kind',
  'member',
  'record',
  'sample',
];

export function assertShape(item, { manager }) {
  assert.deepEqual(Object.keys(item).sort(), ITEM_KEYS);
  assert.deepEqual(Object.keys(item.actor).sort(), ['id', 'name']);
  assert.match(item.at, /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/);
  assert.equal(typeof item.sample, 'boolean');
  if (item.record) assert.deepEqual(Object.keys(item.record).sort(), ['id', 'legacyId']);
  if (item.kind === 'team') {
    assert.ok(manager, 'team events reach managers only');
    assert.equal(item.collection, null);
    assert.equal(item.record, null);
    assert.deepEqual(Object.keys(item.member).sort(), ['id', 'name']);
  } else {
    assert.equal(item.kind, 'record');
    assert.equal(item.member, null);
  }
}
