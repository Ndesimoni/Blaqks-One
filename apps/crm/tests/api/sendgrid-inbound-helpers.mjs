/** Incoming company mail through the SendGrid stand-in's Inbound Parse (E3c). */
import assert from 'node:assert/strict';
import { query } from './helpers.mjs';
import { staffMember } from './mailbox-helpers.mjs';
import { addAddress, connectSendgrid, freshAdmin } from './sendgrid-helpers.mjs';

const sendgrid = process.env.CRM_TEST_SENDGRID;

/** Form fields as SendGrid posts them, signed by the sender's own domain by default. */
export function mailFields({
  from,
  to,
  subject = 'Enquiry',
  text = 'Hello',
  headers = '',
  ...extra
}) {
  const domain = from.split('@').pop().replace(/>$/, '');
  return {
    from,
    to: to.join(', '),
    subject,
    text,
    headers,
    envelope: JSON.stringify({ to, from: `bounce@${domain}` }),
    dkim: `{@${domain} : pass}`,
    SPF: 'pass',
    spam_score: '0.3',
    ...extra,
  };
}

/** Posts one signed mail to the domain's Parse URL; answers the CRM's status and setting. */
export const inbound = async (domain, fields, options = {}) =>
  (
    await fetch(`${sendgrid}/test/inbound?domain=${domain}`, {
      method: 'POST',
      body: JSON.stringify({ fields, ...options }),
    })
  ).json();

/** A company on SendGrid with addresses for the Admin (`owner@`) and one agent (`agent@`). */
export async function mailCompany(prefix, domain) {
  const admin = await freshAdmin(prefix);
  const agent = await staffMember(admin, `${prefix}-agent`, true);
  const connected = await connectSendgrid(admin, domain);
  assert.equal(connected.status, 201, JSON.stringify(connected.value));
  assert.equal(connected.value.incomingMail, true);
  assert.equal((await addAddress(admin, admin.user.id, 'owner')).status, 201);
  assert.equal((await addAddress(admin, agent.user.id, 'agent')).status, 201);
  return { admin, agent, connection: connected.value.connection };
}

/** `count|assignee|state` of the sender's conversations in the workspace. */
export const conversationsOf = (workspace, sender) =>
  query(
    `SELECT count(*)||'|'||coalesce(max(assignee_id::text),'-')||'|'||coalesce(max(state),'-')
     FROM inbox.crm_inbox_conversations WHERE workspace_id='${workspace}' AND contact_key='${sender}'`,
  );

/** Files clients email in (F3b). */
export const mailFile = (name, type, bytes) => ({
  name,
  type,
  base64: Buffer.from(bytes).toString('base64'),
});
export const conversationOf = (workspace, sender) =>
  query(`SELECT id FROM inbox.crm_inbox_conversations
    WHERE workspace_id='${workspace}' AND contact_key='${sender}'`);
export const lastMessage = async (admin, id) =>
  (
    await admin.request(`/workspaces/${admin.user.workspaceId}/inbox/conversations/${id}`)
  ).value.messages.at(-1);

/** Files are stored after the CRM answers SendGrid: waits until none is still pending. */
export async function filesStored(workspace) {
  for (let tries = 0; tries < 100; tries += 1) {
    const pending = query(`SELECT count(*) FROM media.crm_media_objects
      WHERE workspace_id='${workspace}' AND storage_pending AND deleted_at IS NULL`);
    if (pending === '0') return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert.fail('the files were never stored');
}
