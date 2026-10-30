/** Email sending through the messaging worker and the Google stand-in (E1b). */
import assert from 'node:assert/strict';
import { create } from './helpers.mjs';

const inbox = (session, suffix = '') =>
  `/workspaces/${session.user.workspaceId}/inbox/conversations${suffix}`;

let clients = 0;

/** A synthetic client of the Admin's company with this email address. */
export async function clientWith(admin, email) {
  clients += 1;
  return create(admin, 'Clients', {
    client_id: `SEND-${Date.now()}-${clients}`,
    full_name: `Synthetic Mail Client ${clients}`,
    email,
  });
}

export const startMessage = (session, record, overrides = {}) =>
  session.request(inbox(session), {
    method: 'POST',
    body: {
      collection: 'Clients',
      recordId: record.id,
      subject: 'Your viewing in Dubai Marina',
      body: 'Hello, the viewing is confirmed for Saturday at 5.',
      ...overrides,
    },
  });

export const reply = (session, conversation, body) =>
  session.request(inbox(session, `/${conversation}/messages`), { method: 'POST', body: { body } });

export const sendAgain = (session, conversation, message) =>
  session.request(inbox(session, `/${conversation}/messages/${message}/again`), {
    method: 'POST',
  });

/** Waits until the worker settles `message` (not queued or sending) and returns it. */
export async function settled(session, conversation, message) {
  for (let tries = 0; tries < 60; tries += 1) {
    const read = await session.request(inbox(session, `/${conversation}`));
    assert.equal(read.status, 200, JSON.stringify(read.value));
    const found = read.value.messages.find((item) => item.id === message);
    if (found && !['queued', 'sending'].includes(found.status)) return found;
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw Error(`Message ${message} was not settled by the worker.`);
}
