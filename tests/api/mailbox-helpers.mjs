/** Google mailbox sign-in through the loopback stand-in (scripts/fake-google.mjs, E1a). */
import assert from 'node:assert/strict';
import { api } from './helpers.mjs';
import {
  activate,
  findMember,
  invite,
  memberUpdate,
  staffLogin,
  teamPath,
} from './team-helpers.mjs';

export const google = process.env.CRM_TEST_GOOGLE;
export const mailboxPath = (session, suffix = '') =>
  `/workspaces/${session.user.workspaceId}/mailbox${suffix}`;

export const start = (session) =>
  session.request(mailboxPath(session, '/google/start'), { method: 'POST', body: {} });

export const finish = (session, returned) =>
  session.request(mailboxPath(session, '/google/finish'), { method: 'POST', body: returned });

/** What the app receives in the URL fragment after Google and the API callback. */
export async function consent(url, headers = {}) {
  const authorized = await fetch(url, { headers, redirect: 'manual' });
  assert.equal(authorized.status, 302);
  const callback = new URL(authorized.headers.get('location'));
  const apiOrigin = new URL(api).origin;
  const handed = await fetch(`${apiOrigin}${callback.pathname}${callback.search}`, {
    redirect: 'manual',
  });
  assert.equal(handed.status, 303);
  assert.equal(handed.headers.get('cache-control'), 'no-store');
  const location = handed.headers.get('location');
  assert.ok(location.startsWith(`${process.env.CRM_APP_ORIGIN}/#/oauth/google?`), location);
  return Object.fromEntries(new URLSearchParams(location.split('?')[1]));
}

/** Start, consent as `email`, and return the fragment values without finishing. */
export async function signInAs(session, email, headers = {}) {
  const started = await start(session);
  assert.equal(started.status, 200, JSON.stringify(started.value));
  return consent(started.value.url, { 'x-test-email': email, ...headers });
}

export async function connectMailbox(session, email) {
  const finished = await finish(session, await signInAs(session, email));
  assert.equal(finished.status, 200, JSON.stringify(finished.value));
  return finished.value.mailbox;
}

export async function fakeGoogleState() {
  return (await fetch(`${google}/test/state`)).json();
}

/** Revocation runs after the commit; wait until Google has seen `count` revokes. */
export async function revokedCount(count) {
  for (let tries = 0; tries < 30; tries += 1) {
    if ((await fakeGoogleState()).revoked.length >= count) break;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  return (await fakeGoogleState()).revoked.length;
}

/** Disconnects the member's current mailbox, if any (the channel suite leaves a stub). */
export async function clearMailbox(session) {
  const { mailbox } = (await session.request(mailboxPath(session))).value;
  if (!mailbox) return;
  const off = await session.request(mailboxPath(session), {
    method: 'DELETE',
    body: { expectedVersion: mailbox.version },
  });
  assert.equal(off.status, 200, JSON.stringify(off.value));
}

/** A new staff member of `admin`'s company, with the email grant when `email` is set. */
export async function staffMember(admin, suffix, email) {
  const invited = await invite(admin, suffix);
  const staff = await activate(invited);
  if (email) {
    const member = await findMember(admin, staff.user.id);
    const body = memberUpdate(member, { channelAccess: { email: true, whatsapp: false } });
    const updated = await admin.request(teamPath(admin, member.id), { method: 'PATCH', body });
    assert.equal(updated.status, 200, JSON.stringify(updated.value));
  }
  // A fresh session carries the updated email grant.
  return email ? staffLogin(invited.email) : staff;
}
