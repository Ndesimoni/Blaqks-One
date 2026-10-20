/** Fixtures for the Inbox staff API suites (packet X3): teams and seeded conversations. */
import { randomUUID } from 'node:crypto';
import { financeTeams } from './finance-helpers.mjs';
import { query } from './helpers.mjs';
import { grant } from './permission-helpers.mjs';

export const inboxPath = (session, suffix = '') =>
  `/workspaces/${session.user.workspaceId}/inbox/conversations${suffix}`;

/**
 * An Admin team: `agent` is assigned-only with WhatsApp replies, `desk` sees the whole team,
 * `other` is another company's Admin.
 */
export async function inboxTeams(prefix) {
  const teams = await financeTeams(prefix);
  const agent = await grant(teams.admin, teams.agent, {
    channelAccess: { email: false, whatsapp: true },
  });
  const desk = await grant(teams.admin, teams.desk, { recordScope: 'team' });
  return { ...teams, agent, desk, workspace: teams.admin.user.workspaceId };
}

const literal = (value) => (value === null ? 'NULL' : `'${value}'`);

/** Inserts a conversation with one inbound message; returns its ID. */
export function seed(workspace, { channel = 'whatsapp', assignee = null, state = 'new' } = {}) {
  const id = randomUUID();
  const contact =
    channel === 'email' ? `c-${id.slice(0, 8)}@example.test` : `+97150${Date.now() % 10_000_000}`;
  query(
    `INSERT INTO inbox.crm_inbox_conversations (id,workspace_id,channel,connection_id,
       external_thread_id,contact_key,contact_display,match_state,assignee_id,state)
     VALUES ('${id}','${workspace}','${channel}','${randomUUID()}','t-${id}','${contact}',
       '${contact}','unknown',${literal(assignee)},'${state}');
     INSERT INTO inbox.crm_inbox_messages (id,conversation_id,workspace_id,direction,
       provider_message_id,status,body)
     VALUES ('${randomUUID()}','${id}','${workspace}','inbound','m-${id}','received',
       'Synthetic enquiry for ${channel}')`,
  );
  return id;
}

export const events = (conversation, action) =>
  query(
    `SELECT count(*) FROM inbox.crm_inbox_events
     WHERE conversation_id='${conversation}' AND action='${action}'`,
  );
