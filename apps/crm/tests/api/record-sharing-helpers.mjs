import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { add, assignmentTeams, list, setAssignee } from './assignment-helpers.mjs';
import { query } from './helpers.mjs';
import { activate, invite } from './team-helpers.mjs';

export const sharingPath = (session, tail = '', workspace = session.user.workspaceId) =>
  `/workspaces/${workspace}/shares${tail}`;

/** A share route as `session`, in `workspace` (the caller's own by default). */
export const shareRequest = (session, action = '', options = {}, workspace) =>
  session.request(sharingPath(session, action, workspace), options);

export async function sharingTeams(prefix) {
  const teams = await assignmentTeams(prefix);
  return {
    ...teams,
    third: await activate(
      await invite(teams.admin, `${prefix}-three`, { positions: ['property-agent'] }),
    ),
  };
}

export async function held(session, holder, collection, record) {
  const made = await add(session, collection, record);
  setAssignee(made.id, holder.user.id);
  return made;
}

export async function offer(sender, record, to, collection = 'Clients') {
  const result = await shareRequest(sender, '', {
    method: 'POST',
    body: { collection, recordId: record.id, toId: to.user.id },
  });
  assert.equal(result.status, 201, JSON.stringify(result.value));
  return result.value.share;
}

export async function act(session, share, action) {
  return shareRequest(session, `/${share.id}/${action}`, { method: 'POST' });
}

export async function accepted(sender, record, to, collection = 'Clients') {
  const share = await offer(sender, record, to, collection);
  const result = await act(to, share, 'accept');
  assert.equal(result.status, 200, JSON.stringify(result.value));
  assert.equal(result.value.share.status, 'accepted');
  return result.value.share;
}

export async function shares(session, queryString = '') {
  const result = await shareRequest(session, queryString);
  assert.equal(result.status, 200, JSON.stringify(result.value));
  return result.value;
}

export async function candidateIds(session, record, collection = 'Clients') {
  const queryString = new URLSearchParams({ collection, recordId: record.id });
  const result = await shareRequest(session, `/candidates?${queryString}`);
  assert.equal(result.status, 200, JSON.stringify(result.value));
  return result.value.colleagues.map(({ id }) => id);
}

export async function copy(session, collection, id) {
  const body = await list(session);
  return {
    entry: body.records[collection].find((row) => row.id === id),
    kept: body.kept[id],
  };
}

export const shareState = (share) =>
  query(
    `SELECT status||'|'||coalesce(closed_by::text,'-') FROM crm_record_shares WHERE id='${share.id}'`,
  );

export const keepCount = (share) =>
  query(`SELECT count(*) FROM crm_record_keeps WHERE share_id='${share.id}'`);

export const unknownShare = () => ({ id: randomUUID() });
