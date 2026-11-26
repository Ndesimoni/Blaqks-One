import assert from 'node:assert/strict';
import { add, assignmentTeams } from './assignment-helpers.mjs';
import { api, query } from './helpers.mjs';

/** Broker marketplace routes (docs/broker-marketplace.md §13–§15, packet MK1). */
export const marketPath = (session, tail = '', workspace = session.user.workspaceId) =>
  `/workspaces/${workspace}/marketplace${tail}`;

export const market = (session, tail = '', options = {}, workspace) =>
  session.request(marketPath(session, tail, workspace), options);

/** Two company Admins (`admin`, `other`) with staff, and the Super Admin (`owner`). */
export const marketTeams = (prefix) => assignmentTeams(prefix);

export async function status(session, workspace) {
  const result = await market(session, '/status', {}, workspace);
  assert.equal(result.status, 200, JSON.stringify(result.value));
  return result.value;
}

/** Backdates the company so the seven-day rule passes (§15). */
export const backdate = (workspace, days = 8) =>
  query(
    `UPDATE crm_workspaces SET created_at=now()-interval '${days} days' WHERE id='${workspace}'`,
  );

/** Enough synthetic records to meet every checklist line for `session`'s company. */
export async function fill(session) {
  for (let i = 0; i < 5; i += 1)
    await add(session, 'Properties', { property_id: `MK-PR-${i}-${Math.random()}` });
  for (let i = 0; i < 5; i += 1)
    await add(session, 'Clients', { full_name: `Synthetic marketplace client ${i}` });
  for (let i = 0; i < 3; i += 1)
    await add(session, 'Contacts', { contact_id: `MK-CT-${i}-${Math.random()}` });
  for (let i = 0; i < 3; i += 1)
    await add(session, 'Follow-ups', { activity_id: `MK-FU-${i}-${Math.random()}` });
  await add(session, 'Viewings', { viewing_id: `MK-VW-${Math.random()}` });
}

/** A ready company: old enough and with every record line met. */
export async function ready(session) {
  backdate(session.user.workspaceId);
  await fill(session);
}

export async function apply(session) {
  const result = await market(session, '/application', { method: 'POST' });
  assert.equal(result.status, 201, JSON.stringify(result.value));
  return result.value.status;
}

export const applications = (owner, state = 'all') =>
  owner.request(
    `/workspaces/super-admin-workspace/marketplace/applications?state=${encodeURIComponent(state)}`,
  );

export const decide = (owner, workspace, body) =>
  owner.request(`/workspaces/${workspace}/marketplace/decision`, { method: 'POST', body });

/** Approves the company's newest pending application and returns it. */
export async function approve(owner, session) {
  const queue = await applications(owner, 'pending');
  assert.equal(queue.status, 200, JSON.stringify(queue.value));
  const row = queue.value.applications.find(
    (item) => item.workspaceId === session.user.workspaceId,
  );
  assert.ok(row, 'the company has a pending application');
  const result = await decide(owner, session.user.workspaceId, {
    applicationId: row.id,
    decision: 'approved',
  });
  assert.equal(result.status, 200, JSON.stringify(result.value));
  return row;
}

export const switchCompany = (session, enabled, expectedVersion) =>
  market(session, '/company', { method: 'PUT', body: { enabled, expectedVersion } });

/** The first terms version inserted by migration 0074. */
export const TERMS_VERSION = '2026-10-24.1';

export async function termsOf(session, version = TERMS_VERSION) {
  const result = await market(session, `/terms/${encodeURIComponent(version)}`);
  assert.equal(result.status, 200, JSON.stringify(result.value));
  return result.value.terms;
}

/** The terms that are current for the caller's company right now. */
export async function currentTerms(session) {
  const state = await status(session);
  return termsOf(session, state.member.termsVersion);
}

export const joinBody = (terms, overrides = {}) => ({
  profile: {
    emirates: ['dubai'],
    communities: ['Dubai Marina', 'JVC'],
    propertyTypes: ['residential_sale'],
    experienceYears: 4,
    licence: { number: '12345', authority: 'RERA' },
  },
  commitments: [true, true, true, true],
  consent: true,
  termsVersion: terms.version,
  termsDigest: terms.digest,
  ...overrides,
});

export const join = (session, body) => market(session, '/join', { method: 'POST', body });
export const leave = (session) => market(session, '/leave', { method: 'POST' });
export const readProfile = (session, memberId) =>
  market(session, `/profiles/${encodeURIComponent(memberId)}`);
export const editProfile = (session, expectedVersion, profile) =>
  market(session, '/me', { method: 'PATCH', body: { expectedVersion, profile } });

/** A company that meets the checklist, has applied and is approved. */
export async function approvedCompany(admin, owner) {
  await ready(admin);
  await apply(admin);
  await approve(owner, admin);
}

const photoPath = (session, memberId) =>
  marketPath(session, `/profiles/${encodeURIComponent(memberId)}/photo`);

export const photoStatus = async (session, memberId) =>
  (await fetch(`${api}${photoPath(session, memberId)}`, { headers: { Cookie: session.cookie } }))
    .status;

/** A JPEG with a valid header and three megabytes of scan data (the type check passes). */
export const bigJpeg = () => {
  const segment = (marker, data) => {
    const length = Buffer.alloc(2);
    length.writeUInt16BE(data.length + 2);
    return Buffer.concat([Buffer.from([0xff, marker]), length, data]);
  };
  return Buffer.concat([
    Buffer.from([0xff, 0xd8]),
    segment(0xe0, Buffer.from('JFIF\0')),
    Buffer.from([0xff, 0xda, 0x00, 0x02]),
    Buffer.alloc(3 * 1024 * 1024, 0x11),
    Buffer.from([0xff, 0xd9]),
  ]);
};
