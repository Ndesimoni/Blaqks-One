import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { api, query } from './helpers.mjs';
import { assignmentTeams } from './assignment-helpers.mjs';
import { held } from './record-sharing-helpers.mjs';
import { activate, invite } from './team-helpers.mjs';

/** Listing shares with other companies (docs/record-sharing.md R2, packet R2a). */
export const listingPath = (session, tail = '', workspace = session.user.workspaceId) =>
  `/workspaces/${workspace}/agreements/listing-shares${tail}`;

export const listingRequest = (session, tail = '', options = {}, workspace) =>
  session.request(listingPath(session, tail, workspace), options);

/** Two fresh companies: `admin` with agents `one` and `two`, `other` with `agent` and `colleague`. */
export async function outsideTeams(prefix) {
  const teams = await assignmentTeams(prefix);
  const staff = async (suffix) =>
    activate(await invite(teams.other, `${prefix}-${suffix}`, { positions: ['property-agent'] }));
  return { ...teams, agent: await staff('agent'), colleague: await staff('colleague') };
}

/** Markers of fields that must never leave the company. */
export const PRIVATE = ['Os private note', 'Os gate code', 'docs.example.test/os', 'OS-PERMIT'];
export const LOCATION = ['OS-UNIT-1', 'Synthetic Street 9', 'maps.example.test/os'];

/** A listing held by `teams[holder]`, with private fields to prove they never travel. */
export const listing = (teams, holder = 'one', extra = {}) =>
  held(teams.admin, teams[holder], 'Properties', {
    listing_title: `Synthetic Outside Villa ${Math.random().toString(36).slice(2, 8)}`,
    community: 'Dubai Hills',
    emirate: 'Dubai',
    bedrooms: '3',
    listing_status: 'Available',
    property_description: 'Bright villa',
    unit_reference: 'OS-UNIT-1',
    address: 'Synthetic Street 9',
    map_link: 'https://maps.example.test/os',
    notes: 'Os private note',
    viewing_instructions: 'Os gate code',
    photos_documents_url: 'https://docs.example.test/os',
    permit_reference: 'OS-PERMIT',
    ...extra,
  });

/** A Dubai day `days` from today, as the share form sends it. */
export const dubaiDay = (days = 30) =>
  new Date(Date.now() + 4 * 3600e3 + days * 86400e3).toISOString().slice(0, 10);

export async function preview(sender, record, exactLocation = false) {
  const result = await listingRequest(sender, '/preview', {
    method: 'POST',
    body: { recordId: record.id, exactLocation },
  });
  assert.equal(result.status, 200, JSON.stringify(result.value));
  return result.value;
}

export const sendBody = (
  record,
  to,
  review,
  { days = 30, exactLocation = false, note = null } = {},
) => ({
  recordId: record.id,
  recipientWorkspaceId: to.user.workspaceId,
  recipientMemberId: to.user.id,
  viewEndsOn: dubaiDay(days),
  exactLocation,
  note,
  previewDigest: review.previewDigest,
});

export async function send(sender, record, to, options = {}) {
  const review = await preview(sender, record, options.exactLocation);
  const body = sendBody(record, to, review, options);
  const result = await listingRequest(sender, '', { method: 'POST', body });
  assert.equal(result.status, 201, JSON.stringify(result.value));
  return result.value.share;
}

export const act = (session, share, action, body) =>
  listingRequest(session, `/${share.id}/${action}`, { method: 'POST', body });

export async function accepted(sender, record, to, options) {
  const share = await send(sender, record, to, options);
  const result = await act(to, share, 'accept');
  assert.equal(result.status, 200, JSON.stringify(result.value));
  return result.value.share;
}

export async function read(session, share) {
  const result = await listingRequest(session, `/${share.id}`);
  assert.equal(result.status, 200, JSON.stringify(result.value));
  return result.value.share;
}

export async function evidence(session, share) {
  const result = await listingRequest(session, `/${share.id}/evidence`);
  assert.equal(result.status, 200, JSON.stringify(result.value));
  return result.value;
}

/** A share file's status as `session`. */
export const fileStatus = async (session, share, file) =>
  (
    await fetch(`${api}${listingPath(session, `/${share.id}/files/${file}`)}`, {
      headers: { Cookie: session.cookie },
    })
  ).status;

/** The stored status and end reason, read directly. */
export const stored = (share) =>
  query(`SELECT status||'|'||coalesce(end_reason,'-') FROM agreements.crm_listing_shares
    WHERE id='${share.id}'`);

/** Compact JSON with keys sorted at every level, as the server digests it. */
export const canonical = (value) => {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object')
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`)
      .join(',')}}`;
  return JSON.stringify(value);
};
export const sha256 = (text) => createHash('sha256').update(text).digest('hex');
