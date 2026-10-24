import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { query } from './helpers.mjs';
import { approvedCompany, currentTerms, join, joinBody, market } from './marketplace-helpers.mjs';
import { outsideTeams } from './outside-sharing-helpers.mjs';
import { held } from './record-sharing-helpers.mjs';

/** Two approved, switched-on companies whose members have all joined (packet MK2). */
export async function requestTeams(prefix) {
  const teams = await outsideTeams(prefix);
  await approvedCompany(teams.admin, teams.owner);
  await approvedCompany(teams.other, teams.owner);
  for (const session of [
    teams.admin,
    teams.one,
    teams.two,
    teams.other,
    teams.agent,
    teams.colleague,
  ]) {
    await join(session, joinBody(await currentTerms(session)));
  }
  return teams;
}

/** Which company a holder belongs to: the second Admin owns `other`, `agent` and `colleague`. */
const company = { other: 'other', agent: 'other', colleague: 'other' };

/**
 * A synthetic client held by `teams[holder]`, with every requirement field and private values
 * that must never reach the board.
 */
export const client = (teams, holder = 'one', extra = {}) =>
  held(teams[company[holder] || 'admin'], teams[holder], 'Clients', {
    full_name: `Synthetic Request Client ${Math.random().toString(36).slice(2, 8)}`,
    phone: '050 123 4567',
    email: 'synthetic.client@example.test',
    notes: 'Synthetic private note',
    lead_source: 'Portal',
    lead_stage: 'Qualified',
    buy_rent: 'Rent',
    emirate: 'Dubai',
    preferred_communities: 'Dubai Marina, JVC',
    property_type: 'Apartment',
    bedrooms: '2',
    minimum_budget_aed: '90000',
    maximum_budget_aed: '120000',
    target_date: '2026-11-15',
    ...extra,
  });

/** What the form sends back, with one or more values replaced. */
export const requestBody = (overrides = {}) => ({
  purpose: 'rent',
  emirate: 'dubai',
  communities: ['Dubai Marina'],
  openToOtherAreas: false,
  propertyType: 'Apartment',
  bedrooms: 2,
  budgetMinAed: 90_000,
  budgetMaxAed: 120_000,
  ready: 'ready',
  furnishing: 'furnished',
  cheques: 6,
  buildingAge: 'under_5',
  moveIn: '2026-11',
  ...overrides,
});

export const draft = (session, clientId) =>
  market(session, `/requests/draft?clientId=${encodeURIComponent(clientId)}`);

export const postRequest = (session, clientId, overrides = {}, extra = {}) =>
  market(session, '/requests', {
    method: 'POST',
    body: { clientId, request: requestBody(overrides), clientConsent: true, ...extra },
  });

/** A posted request, asserting it was accepted, for the tests that only need one. */
export async function postHeld(session, clientId, overrides = {}) {
  const result = await postRequest(session, clientId, overrides);
  assert.equal(result.status, 201, JSON.stringify(result.value));
  return result.value.request;
}

export const mine = (session) => market(session, '/requests/mine');

export const editRequest = (session, id, expectedVersion, overrides = {}) =>
  market(session, `/requests/${id}`, {
    method: 'PATCH',
    body: { expectedVersion, request: requestBody(overrides) },
  });

export const renewRequest = (session, id) =>
  market(session, `/requests/${id}/renew`, { method: 'POST' });

export const closeRequest = (session, id) =>
  market(session, `/requests/${id}/close`, { method: 'POST' });

export const board = (session, filters = {}) => {
  const query = new URLSearchParams(
    Object.entries(filters).filter(([, value]) => value !== undefined && value !== null),
  ).toString();
  return market(session, `/board${query ? `?${query}` : ''}`);
};

/**
 * Requests seeded straight into the database for `teams.agent`, past the five-open limit, each
 * with a client of its own and a different creation time so paging is deterministic.
 */
export async function seedRequests(teams, count, extra = {}) {
  const workspace = teams.agent.user.workspaceId;
  const ids = [];
  for (let index = 0; index < count; index += 1) {
    const record = await client(teams, 'agent');
    const id = randomUUID();
    const row = {
      purpose: 'rent',
      emirate: 'dubai',
      property_type: 'Apartment',
      bedrooms: 2,
      budget_band: 'rent_150k',
      ready: 'any',
      furnishing: 'any',
      building_age: 'any',
      ...extra,
    };
    query(
      `WITH made AS (INSERT INTO marketplace.crm_market_requests (id,workspace_id,member_id,` +
        `purpose,emirate,communities,open_to_other_areas,property_type,bedrooms,budget_max_aed,` +
        `budget_band,ready,furnishing,building_age,move_in,client_consent_at,expires_at,` +
        `created_at,updated_at) VALUES ('${id}','${workspace}','${teams.agent.user.id}',` +
        `'${row.purpose}','${row.emirate}','[]',false,'${row.property_type}',${row.bedrooms},` +
        `120000,'${row.budget_band}','${row.ready}','${row.furnishing}','${row.building_age}',` +
        `NULL,now(),now()+interval '30 days',now()-interval '${index} minutes',now()) ` +
        `RETURNING id) INSERT INTO marketplace.crm_market_request_sources ` +
        `(request_id,workspace_id,source_record_id,open) ` +
        `SELECT id,'${workspace}','${record.id}',true FROM made`,
    );
    ids.push(id);
  }
  return ids;
}
