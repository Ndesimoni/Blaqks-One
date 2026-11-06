/**
 * WhatsApp sending through the loopback Twilio stand-in (packet W1b): a fresh company whose
 * Twilio token the suite knows (to sign callbacks), the Admin's and an agent's numbers,
 * synthetic +999 clients, and the Inbox routes the composer uses.
 */
import assert from 'node:assert/strict';
import { postSigned } from '../../../../scripts/fake-twilio-sign.mjs';
import { add } from './assignment-helpers.mjs';
import { twilioSid, twilioToken } from './channels-helpers.mjs';
import { freshAdmin } from './sendgrid-helpers.mjs';
import { activate, invite, staffLogin } from './team-helpers.mjs';
import { connectTwilio, given, phone, setAccess, setSenders, twilio } from './whatsapp-helpers.mjs';

export { RESERVED } from '../../../../scripts/fake-twilio-messages.mjs';
export const inbox = (session, suffix = '') =>
  `/workspaces/${session.user.workspaceId}/inbox${suffix}`;

/** A staff agent of `admin`'s company who holds their own records, with the WhatsApp grant. */
export async function agent(admin, suffix, whatsapp = true) {
  const invited = await invite(admin, suffix, { positions: ['property-agent'] });
  const staff = await activate(invited);
  if (!whatsapp) return staff;
  await setAccess(admin, staff, { channelAccess: { email: false, whatsapp: true } });
  return staffLogin(invited.email);
}

/** A company with its Twilio account, the Admin's own number and an agent with theirs. */
export async function sendingCompany(prefix) {
  const admin = await freshAdmin(prefix);
  const [sid, token] = [twilioSid(), twilioToken()];
  const phones = [phone(), phone(), phone()];
  await setSenders(
    sid,
    phones.map((value) => ({ phone: value, status: 'ONLINE' })),
  );
  const made = await connectTwilio(admin, sid, token);
  assert.equal(made.status, 201, JSON.stringify(made.value));
  const staff = await agent(admin, `${prefix}-agent`);
  const adminNumber = await given(admin, admin.user.id, phones[0]);
  const agentNumber = await given(admin, staff.user.id, phones[1]);
  const connection = made.value.connection;
  return { admin, agent: staff, sid, token, phones, connection, adminNumber, agentNumber, made };
}

let clients = 0;
/** A synthetic client of `session`'s own, with this phone. */
export async function clientWith(session, value = phone()) {
  clients += 1;
  const name = `Synthetic WhatsApp Client ${clients}`;
  // Assigned-only staff never type record IDs; the server issues one.
  return add(session, 'Clients', { full_name: name, phone: value });
}

export const templates = async (admin) =>
  (await admin.request(`/workspaces/${admin.user.workspaceId}/whatsapp-templates`)).value;
export const templateId = async (admin, name) =>
  (await templates(admin)).templates.find((template) => template.name === name).id;

export const startState = (session, record) =>
  session.request(inbox(session, `/whatsapp/start?collection=Clients&recordId=${record.id}`));
export const agree = (session, record, change = { change: 'agreed', source: 'phone' }) =>
  session.request(inbox(session, '/whatsapp/consent'), {
    method: 'POST',
    body: { collection: 'Clients', recordId: record.id, ...change },
  });
export const threadConsent = (session, id, change) =>
  session.request(inbox(session, `/conversations/${id}/consent`), { method: 'POST', body: change });

export const start = (session, record, content) =>
  session.request(inbox(session, '/conversations'), {
    method: 'POST',
    body: { channel: 'whatsapp', collection: 'Clients', recordId: record.id, ...content },
  });
export const reply = (session, id, content) =>
  session.request(inbox(session, `/conversations/${id}/messages`), {
    method: 'POST',
    body: content,
  });
export const again = (session, id, message) =>
  session.request(inbox(session, `/conversations/${id}/messages/${message}/again`), {
    method: 'POST',
  });
export const read = async (session, id) => {
  const found = await session.request(inbox(session, `/conversations/${id}`));
  assert.equal(found.status, 200, JSON.stringify(found.value));
  return found.value;
};

/** The offered template `name` as the composer lists it for `record`. */
export async function offered(session, record, name) {
  const state = await startState(session, record);
  assert.equal(state.status, 200, JSON.stringify(state.value));
  return state.value.templates.find((template) => template.name === name)?.id;
}

/** Agrees for `record` and starts with an approved template; returns the started value. */
export async function started(session, record, name = 'new_listing', variables = []) {
  assert.equal((await agree(session, record)).status, 200);
  const id = await offered(session, record, name);
  const result = await start(session, record, { template: { id, variables } });
  assert.equal(result.status, 201, JSON.stringify(result.value));
  return result.value;
}

/** Waits until the message reaches one of `statuses` and returns it. */
export async function reached(session, conversation, message, statuses, tries = 120) {
  for (let attempt = 0; attempt < tries; attempt += 1) {
    const found = (await read(session, conversation)).messages.find((item) => item.id === message);
    if (found && statuses.includes(found.status)) return found;
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw Error(`Message ${message} did not reach ${statuses.join(' or ')}.`);
}

/** What the stand-in received for messages to `to` (`whatsapp:+…` or a bare phone). */
export async function sentTo(to) {
  const state = await (await fetch(`${twilio}/test/state`)).json();
  return state.sent.filter((item) => item.to === `whatsapp:${to.replace(/^whatsapp:/, '')}`);
}

export async function setTemplates(sid, list) {
  const response = await fetch(`${twilio}/test/templates?sid=${sid}`, {
    method: 'POST',
    body: JSON.stringify(list),
  });
  assert.equal(response.status, 200);
}

/** The callback URL the CRM gives Twilio for `message`. */
export const statusUrl = (connection, message, query = `m=${message}`) =>
  `${process.env.CRM_PUBLIC_URL}/api/integrations/webhooks/twilio/${connection}/status?${query}`;
export const callback = (company, url, params, options) =>
  postSigned(url, params, company.token, options);
