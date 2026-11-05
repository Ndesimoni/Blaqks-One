import { randomUUID } from 'node:crypto';
import { query } from '../api/helpers.mjs';
import { twilioToken } from '../api/channels-helpers.mjs';

/** Removes a workspace's conversations (messages, notes and reads cascade). */
export function clearInbox(workspace) {
  query(`DELETE FROM inbox.crm_inbox_conversations WHERE workspace_id='${workspace}'`);
}

/**
 * A live WhatsApp connection for the workspace, made through the Channels API with a
 * synthetic Twilio Account SID (`account`) that the loopback Twilio stand-in proves.
 */
export async function connectWhatsapp(page, identity, account) {
  const workspace = identity.user.workspaceId;
  query(`UPDATE integrations.crm_channel_connections
     SET state='disconnected',credential_sealed=NULL,credential_key_version=NULL,
         credential_updated_at=NULL,version=version+1
     WHERE workspace_id='${workspace}' AND state<>'disconnected'`);
  const created = await page.request.post(`/api/crm/workspaces/${workspace}/channels`, {
    headers: { Origin: 'http://localhost:5175', 'X-CSRF-Token': identity.csrfToken },
    data: {
      connection: {
        channel: 'whatsapp',
        provider: 'twilio',
        label: 'Inbox test line',
        externalAccountId: account,
        credential: twilioToken(),
      },
    },
  });
  if (created.status() !== 201) throw Error(`Could not connect WhatsApp: ${created.status()}`);
}

const text = (value) => `'${String(value).replaceAll("'", "''")}'`;

/**
 * Inserts a conversation and its messages, oldest first, `minutesAgo` apart from now.
 * `outbound` messages need `author`.
 */
export function seedConversation(workspace, conversation) {
  const {
    channel = 'whatsapp',
    contact = '+971500000417',
    name = null,
    match = 'unknown',
    assignee = null,
    state = 'new',
    suggested = false,
    messages = [],
  } = conversation;
  const id = randomUUID();
  const rows = messages.map((message, index) => {
    const author = message.author ? text(message.author) : 'NULL';
    const ago = (messages.length - index) * 7;
    return `(${text(randomUUID())},${text(id)},${text(workspace)},${text(message.direction || 'inbound')},
      ${text(`m-${randomUUID()}`)},${text(message.status || 'received')},${author},${text(message.body)},
      now()-interval '${ago} minutes')`;
  });
  query(`INSERT INTO inbox.crm_inbox_conversations (id,workspace_id,channel,connection_id,
      external_thread_id,contact_key,contact_display,contact_name,match_state,assignee_id,state,
      suggested_lead,last_activity_at)
    VALUES (${text(id)},${text(workspace)},${text(channel)},${text(randomUUID())},${text(`t-${id}`)},
      ${text(contact)},${text(contact)},${name ? text(name) : 'NULL'},${text(match)},
      ${assignee ? text(assignee) : 'NULL'},${text(state)},${suggested},now());
    INSERT INTO inbox.crm_inbox_messages (id,conversation_id,workspace_id,direction,
      provider_message_id,status,author_user_id,body,created_at) VALUES ${rows.join(',')}`);
  return id;
}
