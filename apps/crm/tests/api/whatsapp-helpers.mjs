/**
 * WhatsApp through the loopback Twilio stand-in (scripts/fake-twilio.mjs, packet W1a): a
 * fresh company with its Twilio account, staff with or without the WhatsApp grant, and
 * members' numbers. Every phone uses the unassigned country code +999.
 */
import assert from 'node:assert/strict';
import { randomInt } from 'node:crypto';
import { channelPath, twilioSid, twilioToken } from './channels-helpers.mjs';
import { query } from './helpers.mjs';
import { freshAdmin } from './sendgrid-helpers.mjs';
import {
  activate,
  findMember,
  invite,
  memberUpdate,
  staffLogin,
  teamPath,
} from './team-helpers.mjs';

export const twilio = process.env.CRM_TEST_TWILIO;
export const numbersPath = (session, suffix = '') =>
  `/workspaces/${session.user.workspaceId}/whatsapp-numbers${suffix}`;

/** A synthetic phone no real person can have. */
export const phone = () => `+9997${String(randomInt(10_000_000)).padStart(7, '0')}`;

/** The senders the stand-in lists for `sid`: `[{phone, status}]`. */
export async function setSenders(sid, senders) {
  const response = await fetch(`${twilio}/test/senders?sid=${sid}`, {
    method: 'POST',
    body: JSON.stringify(senders),
  });
  assert.equal(response.status, 200);
}

/** Makes the stand-in refuse the account's token from now on. */
export async function revoke(sid) {
  const response = await fetch(`${twilio}/test/revoke?sid=${sid}`, { method: 'POST' });
  assert.equal(response.status, 200);
}

export const connectTwilio = (admin, sid, credential = twilioToken()) =>
  admin.request(channelPath(admin), {
    method: 'POST',
    body: {
      connection: {
        channel: 'whatsapp',
        provider: 'twilio',
        label: 'Company WhatsApp',
        externalAccountId: sid,
        credential,
      },
    },
  });

/** A fresh company whose Twilio account lists `online` senders and one OFFLINE sender. */
export async function whatsappCompany(prefix, online = 3) {
  const admin = await freshAdmin(prefix);
  const sid = twilioSid();
  const phones = Array.from({ length: online }, phone);
  const offline = phone();
  const senders = phones.map((value) => ({ phone: value, status: 'ONLINE' }));
  await setSenders(sid, [...senders, { phone: offline, status: 'OFFLINE' }]);
  const made = await connectTwilio(admin, sid);
  assert.equal(made.status, 201, JSON.stringify(made.value));
  return { admin, sid, phones, offline, connection: made.value.connection };
}

/** A staff member of `admin`'s company, with the WhatsApp grant unless `whatsapp` is false. */
export async function whatsappStaff(admin, suffix, whatsapp = true) {
  const invited = await invite(admin, suffix);
  const staff = await activate(invited);
  if (!whatsapp) return staff;
  await setAccess(admin, staff, { channelAccess: { email: false, whatsapp: true } });
  // A fresh session carries the new grant.
  return staffLogin(invited.email);
}

/** Changes a member through the team route, as `admin`. */
export async function setAccess(admin, member, changes) {
  const current = await findMember(admin, member.user.id);
  const body = memberUpdate(current, changes);
  const updated = await admin.request(teamPath(admin, current.id), { method: 'PATCH', body });
  assert.equal(updated.status, 200, JSON.stringify(updated.value));
}

export const give = (admin, memberId, value) =>
  admin.request(numbersPath(admin), { method: 'POST', body: { memberId, phone: value } });

/** Gives a number and returns it. */
export async function given(admin, memberId, value) {
  const result = await give(admin, memberId, value);
  assert.equal(result.status, 201, JSON.stringify(result.value));
  return result.value.number;
}

export const disconnectNumber = (session, number, expectedVersion = number.version) =>
  session.request(numbersPath(session, `/${number.id}/disconnect`), {
    method: 'POST',
    body: { expectedVersion },
  });

/** `state|version` of a stored number. */
export const stored = (id) =>
  query(`SELECT state||'|'||version FROM integrations.crm_whatsapp_numbers WHERE id='${id}'`);

/** How many number events of `action` the company's connections hold. */
export const numberEvents = (workspace, action) =>
  query(`SELECT count(*) FROM integrations.crm_integration_events
     WHERE workspace_id='${workspace}' AND action='${action}'`);
