import assert from 'node:assert/strict';
import { thisMonth } from './platform-metrics-helpers.mjs';

/** The exact reply shape of `GET /platform/metrics` (BO1d) that the dashboard is built on. */
const keys = (value) => Object.keys(value).sort();
export const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/;
export const DAY = /^\d{4}-\d{2}-\d{2}$/;
const COMPANY_KEYS = ['activeUsers30d', 'admin', 'createdOn', 'id', 'lastActiveAt', 'name']
  .concat(['records', 'seatLimit', 'seatsUsed', 'status'])
  .sort();

export function assertShape(value) {
  assert.deepEqual(keys(value), [
    'companies',
    'generatedAt',
    'growth',
    'inPeriod',
    'period',
    'totals',
    'trends',
  ]);
  assert.match(value.generatedAt, ISO);
  assert.deepEqual(keys(value.totals), [
    'activeUsers',
    'companies',
    'deals',
    'interBroker',
    'marketplace',
    'outsideAgents',
    'payments',
    'records',
    'users',
    'websiteVisitors',
    'websites',
  ]);
  assert.equal(value.totals.websiteVisitors, null, 'not tracked yet');
  assert.equal(typeof value.totals.websites.generalSiteLive, 'boolean');
  assert.deepEqual(keys(value.totals.records.byType), [
    'Client care',
    'Clients',
    'Contacts',
    'Follow-ups',
    'Interaction log',
    'Properties',
    'Shortlist',
    'Viewings',
  ]);
  assert.equal(value.trends.months.length, 12);
  assert.equal(value.trends.months.at(-1), thisMonth());
  for (const [name, series] of Object.entries(value.trends)) assert.equal(series.length, 12, name);
  assert.equal(keys(value.inPeriod).length, 15);
  assert.equal(keys(value.growth).length, 4);
  for (const row of value.companies) {
    assert.deepEqual(keys(row), COMPANY_KEYS, 'usage only, never money');
    assert.ok(row.lastActiveAt === null || ISO.test(row.lastActiveAt), row.lastActiveAt);
  }
  assert.doesNotMatch(JSON.stringify(value), /@|password|csrf/i);
}
