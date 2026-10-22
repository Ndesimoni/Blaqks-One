/** Helpers for the H3 suites: the client and property follow a moved deal (agreements
 * design §18). Synthetic records only, on the disposable test database. */
import assert from 'node:assert/strict';
import { query } from './helpers.mjs';

/** The caller's record list: `{records, kept}`. */
export async function listed(session) {
  const result = await session.request(`/workspaces/${session.user.workspaceId}/records`);
  assert.equal(result.status, 200, JSON.stringify(result.value));
  return result.value;
}

/** Whether `id` is in the caller's `collection` list, and its keep badge if any. */
export async function seenAs(session, collection, id) {
  const { records, kept } = await listed(session);
  return {
    listed: records[collection].some((entry) => entry.id === id),
    kept: kept[id] ?? null,
  };
}

export const holderOf = (record) =>
  query(`SELECT assignee_id FROM crm_records WHERE id='${record.id}'`);

export const keepsOf = (member) =>
  query(`SELECT count(*) FROM crm_record_keeps WHERE member_id='${member.user.id}'`);

/** A PATCH of a record the caller only keeps gets the hidden record's 404 and changes
 * nothing (H3 amendment 5). */
export async function refusesEdit(session, collection, made) {
  const path = `/workspaces/${session.user.workspaceId}/records/${collection}/${made.id}`;
  const result = await session.request(path, {
    method: 'PATCH',
    body: { version: made.version, record: { ...made.record, notes: 'Synthetic H3 edit' } },
  });
  assert.equal(result.status, 404, `${collection}: ${JSON.stringify(result.value)}`);
  const notes = query(
    `SELECT coalesce(payload->>'notes','') FROM crm_records WHERE id='${made.id}'`,
  );
  assert.notEqual(notes, 'Synthetic H3 edit', `${collection} is read-only`);
}

/** An open email conversation linked to the client, held by `holder`. */
export function conversation(holder, client) {
  const ws = holder.user.workspaceId;
  return query(`WITH made AS (INSERT INTO inbox.crm_inbox_conversations (id,workspace_id,channel,
    connection_id,external_thread_id,contact_key,contact_display,match_state,
    linked_collection,linked_record_id,assignee_id,state) VALUES (gen_random_uuid(),'${ws}',
    'email',gen_random_uuid(),'h3-${client.id}','h3@example.test','h3@example.test','linked',
    'Clients','${client.id}','${holder.user.id}','open') RETURNING id) SELECT id FROM made`);
}

export const conversationHolder = (id) =>
  query(`SELECT assignee_id FROM inbox.crm_inbox_conversations WHERE id='${id}'`);

/** The badge facts a keep shows, without its time. */
export const badge = (kept) => {
  assert.match(kept.at, /^\d{4}-\d{2}-\d{2}T/);
  const { at, ...rest } = kept;
  return rest;
};
