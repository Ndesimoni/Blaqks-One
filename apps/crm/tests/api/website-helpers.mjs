import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { api, query } from './helpers.mjs';
import { add, assignmentTeams } from './assignment-helpers.mjs';
import { upload, jpegWithGps } from './media-helpers.mjs';

export const websitePath = (session, tail = '') =>
  `/workspaces/${session.user.workspaceId}/website${tail}`;
export const put = (session, path, body) => session.request(path, { method: 'PUT', body });
export const ok = (response, status = 200) => {
  assert.equal(response.status, status, JSON.stringify(response.value));
  return response.value;
};
export async function publicRequest(path, options = {}) {
  const response = await fetch(`${api.replace(/\/api\/crm$/, '')}/api/public/v1/${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  return {
    status: response.status,
    headers: response.headers,
    value: await response.json().catch(() => null),
  };
}
export const publicPath = (site, tail) =>
  `sites/${site.id}/${tail}${tail.includes('?') ? '&' : '?'}host=${site.host}`;
export async function setup(prefix) {
  const teams = await assignmentTeams(`web-${prefix}-${randomUUID().slice(0, 6)}`);
  const version = Number(
    query("SELECT coalesce(max(version),0) FROM sites.crm_website_sites WHERE kind='platform'"),
  );
  const platform = ok(
    await put(teams.owner, '/platform/websites/general', {
      version,
      name: 'Blaqks One test',
      host: 'blaqks.localhost',
      theme: '1',
      content: { heroTitle: 'Public platform hero' },
    }),
  ).site;
  const one = await company(teams, teams.admin, `a-${randomUUID().slice(0, 8)}`);
  const two = await company(teams, teams.other, `b-${randomUUID().slice(0, 8)}`);
  return {
    ...teams,
    platform,
    a: one.site,
    b: two.site,
    profile: one.profile,
    otherProfile: two.profile,
  };
}
export async function company(teams, admin, slug) {
  let site = ok(
    await put(admin, websitePath(admin), {
      version: 0,
      name: `Company ${slug}`,
      slug,
      theme: '4',
      company: { mark: 'WC', area: 'Dubai', note: 'Public company note' },
      content: { about: 'Public company story' },
    }),
  ).site;
  site = ok(
    await put(teams.owner, `/platform/websites/companies/${admin.user.workspaceId}/eligibility`, {
      version: site.version,
      licenceVerified: true,
      entitled: true,
    }),
  ).site;
  const profile = ok(
    await put(admin, websitePath(admin, `/profiles/${admin.user.id}`), {
      version: 0,
      name: `Public ${slug}`,
      specialty: 'Residential properties',
      publicWhatsApp: '+447700900001',
      publicEmail: `${slug}@public.example`,
      consent: true,
      active: true,
    }),
  ).profile;
  return { site, profile };
}
export async function property(session, extras = {}, bytes = jpegWithGps()) {
  const media = ok(await upload(session, bytes, 'PRIVATE-OWNER-PHOTO.jpg'), 201).media;
  return add(session, 'Properties', {
    listing_title: 'Public home',
    sale_rental: 'Sale',
    price_basis: 'Total price',
    emirate: 'Dubai',
    community: 'Dubai Marina',
    building_project: 'PRIVATE-TOWER',
    unit_reference: `PRIVATE-UNIT-${randomUUID()}`,
    property_type: 'Apartment',
    bedrooms: '2',
    bathrooms: '2',
    area_sq_ft: 1200,
    price_annual_rent_aed: 2500000,
    listing_status: 'Available',
    ready_off_plan: 'Ready',
    furnishing: 'Unfurnished',
    property_description: 'Public home description',
    notes: 'PRIVATE-NOTES',
    address: 'PRIVATE-EXACT-ADDRESS',
    viewing_instructions: 'PRIVATE-GATE-CODE',
    map_link: 'https://maps.example.test/private',
    media_photos: [{ name: 'PRIVATE-OWNER-PHOTO.jpg', file: media.id, type: 'image/jpeg' }],
    ...extras,
  });
}
export const publishBody = (entry, profile, extras = {}) => ({
  recordId: entry.id,
  recordVersion: entry.version,
  agentProfileId: profile.id,
  version: 0,
  destination: 'general_and_company',
  permitReference: 'SYNTHETIC-PERMIT',
  developer: 'emaar',
  photos: entry.record.media_photos.map((p) => p.file),
  ...extras,
});
export const publish = (session, entry, profile, extras) =>
  session.request(websitePath(session, '/listings'), {
    method: 'POST',
    body: publishBody(entry, profile, extras),
  });
