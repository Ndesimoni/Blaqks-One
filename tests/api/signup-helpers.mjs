import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { query, request } from './helpers.mjs';

export const terms = 'draft-2026-10-16';
export const privacy = 'draft-2026-10-16';
export const botToken = 'local-development';

export function email(label = 'account') {
  return `${label}-${randomUUID()}@example.test`;
}

export function details(overrides = {}) {
  return {
    name: 'Synthetic Signup',
    email: email(),
    phone: '+971501234567',
    password: 'Synth3tic!Signup',
    termsVersion: terms,
    privacyVersion: privacy,
    language: 'en',
    botToken,
    ...overrides,
  };
}

export async function start(body = details()) {
  return request('/signup/start', { method: 'POST', body });
}

export async function started(body = details()) {
  const response = await start(body);
  assert.equal(response.status, 202, JSON.stringify(response.value));
  return { body, response, ticket: response.value.requestId };
}

export function digest(value) {
  return createHash('sha256').update(value).digest('hex');
}

export function codeFor(ticket) {
  const value = query(
    `SELECT o.code FROM crm_signup_outbox o JOIN crm_signup_requests r ` +
      `ON r.id=o.request_id WHERE r.ticket_hash='${digest(ticket)}' ` +
      `AND o.kind='code' ORDER BY o.created_at DESC LIMIT 1`,
  );
  assert.match(value, /^\d{6}$/);
  return value;
}

export async function verify(ticket, code = codeFor(ticket)) {
  return request('/signup/verify', {
    method: 'POST',
    body: { requestId: ticket, code },
  });
}

export function resetSignup() {
  query('TRUNCATE crm_signup_requests CASCADE');
  query('TRUNCATE crm_login_limits');
}

export function invitationFixture(address, live = true) {
  const id = randomUUID();
  const owner = query("SELECT id FROM crm_users WHERE email='owner@crm-fixture.test'");
  query(
    `INSERT INTO crm_users(id,name,email,phone,password_hash,role,active,accepted_at) VALUES ` +
      `('${id}','Synthetic Invite','${address}','+971501234567','','admin',false,NULL);` +
      `INSERT INTO crm_team_invitations(token_hash,user_id,owner_id,workspace_id,created_by,` +
      `expires_at,revoked_at) VALUES ('fixture-${id}','${id}','${owner}',` +
      `'super-admin-workspace','${owner}',now()+interval '1 hour',` +
      `${live ? 'NULL' : 'now()'});` +
      `INSERT INTO crm_team_activity(id,actor_id,workspace_id,member_id,action) VALUES ` +
      `('${randomUUID()}','${owner}','super-admin-workspace','${id}','invited')`,
  );
  return id;
}
