import assert from 'node:assert/strict';
import { request } from './helpers.mjs';
import { activate, invite } from './team-helpers.mjs';

/** Fictional browser agents for the coarse device label. */
export const chromeMac =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36';
export const safariPhone =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';

export const cookieOf = (response) => response.headers.get('set-cookie')?.split(';')[0];

/** A signed-in session from the real login route, optionally with a browser agent. */
export async function signIn(email, password = 'Team123!', agent) {
  const response = await request('/auth/login', {
    method: 'POST',
    body: { email, password },
    headers: agent ? { 'User-Agent': agent } : {},
  });
  assert.equal(response.status, 200, JSON.stringify(response.value));
  const cookie = cookieOf(response);
  const csrf = response.value.csrfToken;
  return {
    cookie,
    csrf,
    user: response.value.user,
    request: (path, options) => request(path, { cookie, csrf, ...options }),
  };
}

/** A freshly invited and activated staff member of `owner`, so fixture passwords never change. */
export async function newStaff(owner, suffix) {
  const invited = await invite(owner, suffix);
  const staff = await activate(invited);
  return { ...staff, email: invited.email };
}

export const changePassword = (session, currentPassword, newPassword, options = {}) =>
  session.request('/auth/account/password', {
    method: 'POST',
    body: { currentPassword, newPassword },
    ...options,
  });

export const sessionStatus = async (cookie) => (await request('/auth/session', { cookie })).status;

export const updateAccount = (session, body, options = {}) =>
  session.request('/auth/account', { method: 'PATCH', body, ...options });
