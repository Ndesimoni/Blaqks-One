// Blaqks One's own clients (BO1e, docs/blaqks-one-console.md §9 and §11): the platform
// routes behind the `clients` area and the marketing website's public contact intake.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { api, query } from './helpers.mjs';

export const CLIENTS = '/platform/clients';
export const STAGES = ['new', 'contacted', 'demo_booked', 'signed_up', 'customer', 'lost'];

export const ok = (response, status = 200) => {
  assert.equal(response.status, status, JSON.stringify(response.value));
  return response.value;
};

/** A synthetic client body; every value is fictional. */
export const clientBody = (label, changes = {}) => ({
  companyName: `Synthetic ${label} Realty`,
  contactName: `Synthetic ${label}`,
  phone: '+971501234567',
  email: `${label}-${randomUUID().slice(0, 8)}@clients.test`,
  source: 'call',
  stage: 'new',
  notes: 'Fictional prospect for API tests.',
  nextFollowUp: '2026-12-01',
  ...changes,
});

/** Adds a client through the API and returns it. */
export async function addClient(session, label, changes) {
  return ok(
    await session.request(CLIENTS, { method: 'POST', body: clientBody(label, changes) }),
    201,
  ).client;
}

/** One client with its timeline. */
export async function readClient(session, id) {
  return ok(await session.request(`${CLIENTS}/${id}`));
}

/** The clients list for a query string such as `?stage=new&q=…`. */
export async function listClients(session, search = '') {
  return ok(await session.request(`${CLIENTS}${search}`));
}

/** Every clients route, as `[level, method, path, body]`, aimed at `id`. */
export const clientRoutes = (id, version = 1) => [
  ['view', 'GET', CLIENTS],
  ['view', 'GET', `${CLIENTS}/owners`],
  ['view', 'GET', `${CLIENTS}/${id}`],
  ['manage', 'POST', CLIENTS, clientBody('forged')],
  ['manage', 'PATCH', `${CLIENTS}/${id}`, { version, stage: 'lost' }],
  ['manage', 'POST', `${CLIENTS}/${id}/timeline`, { kind: 'call', body: 'Forged' }],
  ['manage', 'DELETE', `${CLIENTS}/${id}`, { version }],
];

const intakeUrl = () => `${api.replace(/\/api\/crm$/, '')}/api/public/blaqks-one/contact`;

/** What the marketing site's relay sends: no cookie, no browser origin. */
export const contactBody = (label, changes = {}) => ({
  name: `Synthetic ${label}`,
  company: `Synthetic ${label} Brokerage`,
  email: `${label}-${randomUUID().slice(0, 8)}@contact.test`,
  phone: '+971501234567',
  message: 'Team size: 2-5\n\nFictional message asking for a demo.',
  website: '',
  ...changes,
});

/** Posts to the public intake as the relay, budgeted under the test client address. */
export async function contact(body, client = '192.0.2.10', headers = {}) {
  const response = await fetch(intakeUrl(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Test-Client': client, ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
  return { status: response.status, value: await response.json().catch(() => null) };
}

/** Stored clients with this email (archived included). */
export const storedWith = (email) =>
  query(`SELECT count(*) FROM platform_clients.crm_platform_clients WHERE email='${email}'`);
