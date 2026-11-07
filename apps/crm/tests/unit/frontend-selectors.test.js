import assert from 'node:assert/strict';
import test from 'node:test';
import {
  selectClientDesk,
  selectClientMatches,
  selectClientTimeline,
} from '../../src/features/clients/selectors.js';
import {
  defaultPropertyFilters,
  selectProperties,
} from '../../src/features/properties/selectors.js';
import { blank } from '../../src/lib/schema.js';

test('property selectors combine purpose, field, price and linked text filters without mutating records', () => {
  const data = blank();
  const property = {
    property_id: 'PR-1',
    sale_rental: 'Rental',
    emirate: 'Dubai',
    bedrooms: 2,
    price_annual_rent_aed: 100000,
    listing_title: 'Marina rental',
  };
  data.Properties = [
    property,
    { property_id: 'PR-2', sale_rental: 'Sale', emirate: 'Dubai', price_annual_rent_aed: 500000 },
  ];
  const filters = {
    ...defaultPropertyFilters(),
    purpose: 'Rental',
    bedrooms: '2',
    maxPrice: '110000',
  };
  assert.deepEqual(selectProperties(data, { filters, query: ' MARINA ' }), [property]);
  assert.equal(data.Properties.length, 2);
  filters.maxPrice = '90000';
  assert.deepEqual(selectProperties(data, { filters }), []);
});
test('client matching retains the 8 percent budget tolerance and client search chooses a matching profile', () => {
  const data = blank();
  const a = {
    client_id: 'CL-1',
    full_name: 'Alice',
    buy_rent: 'Buy',
    maximum_budget_aed: 1000000,
    preferred_communities: 'Marina, Downtown',
  };
  const b = { client_id: 'CL-2', full_name: 'Bob' };
  data.Clients = [a, b];
  data.Properties = [
    {
      property_id: 'PR-1',
      sale_rental: 'Sale',
      community: 'Dubai Marina',
      price_annual_rent_aed: 1080000,
    },
    {
      property_id: 'PR-2',
      sale_rental: 'Sale',
      community: 'Dubai Marina',
      price_annual_rent_aed: 1080001,
    },
    {
      property_id: 'PR-3',
      sale_rental: 'Rental',
      community: 'Marina',
      price_annual_rent_aed: 100000,
    },
  ];
  assert.deepEqual(selectClientMatches(data.Properties, a), [data.Properties[0]]);
  assert.equal(selectClientDesk(data, 'bob', 'CL-1').client, b);
  assert.equal(selectClientDesk(data, 'no results', 'CL-1').client, undefined);
});
test('client timelines include both follow-ups and viewings, newest first', () => {
  const data = blank();
  const client = { client_id: 'CL-1' };
  data['Follow-ups'] = [
    {
      activity_id: 'FU-1',
      client_id: 'CL-1',
      contact_date: '2026-01-01',
      next_action: 'Call',
      outcome_notes: 'Discussed budget',
    },
  ];
  data.Viewings = [
    { viewing_id: 'VW-1', client_id: 'CL-1', appointment_date_time: '2026-02-01T10:00' },
  ];
  const timeline = selectClientTimeline(data, client);
  assert.equal(timeline.length, 2);
  assert.equal(timeline[0].title, 'Property viewing');
  assert.equal(timeline[1].detail, 'Discussed budget');
});
