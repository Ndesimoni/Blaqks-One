import assert from 'node:assert/strict';
import test from 'node:test';
import {
  INCOMPLETE,
  readPlatformMetrics,
  seriesTotal,
  websitesLive,
} from '../../src/features/server/platformDashboard/metricsModel.js';
import { figureSections } from '../../src/features/server/platformDashboard/figureSections.js';
import { sampleMetrics } from './platform-metrics-fixture.js';

const refused = (change) => {
  const value = sampleMetrics();
  change(value);
  assert.throws(() => readPlatformMetrics(value), { message: INCOMPLETE });
};

test('a complete reply is accepted as it is, nulls included', () => {
  const value = sampleMetrics();
  assert.equal(readPlatformMetrics(value), value);
  value.totals.websites.generalSiteLive = null;
  value.growth.medianDaysToFirstEarnedDeal = null;
  value.trends.enquiries[0] = null;
  assert.equal(readPlatformMetrics(value), value);
});

test('missing parts are refused with a clear message, never read as zero', () => {
  assert.throws(() => readPlatformMetrics(null), { message: INCOMPLETE });
  assert.throws(() => readPlatformMetrics({}), { message: INCOMPLETE });
  refused((value) => delete value.generatedAt);
  refused((value) => (value.period.key = '7d'));
  refused((value) => delete value.totals.deals.openValueFils);
  refused((value) => delete value.totals.records.byType['Client care']);
  refused((value) => delete value.totals.websiteVisitors);
  refused((value) => delete value.inPeriod.websiteSales);
  refused((value) => delete value.growth.companiesStopped);
  refused((value) => delete value.trends.interBrokerAgreements);
  refused((value) => delete value.companies);
});

test('figures must be whole, non-negative numbers; money must be whole fils', () => {
  refused((value) => (value.totals.users.total = -1));
  refused((value) => (value.totals.users.total = '61'));
  refused((value) => (value.totals.deals.earnedValueFils = 10.5));
  refused((value) => (value.inPeriod.enquiries = undefined));
  refused((value) => (value.growth.medianDaysToFirstEarnedDeal = -2));
  refused((value) => (value.totals.websites.generalSiteLive = 'yes'));
});

test('trends need twelve months, oldest first, and twelve figures per series', () => {
  refused((value) => value.trends.months.pop());
  refused((value) => (value.trends.months[0] = '2025-13'));
  refused((value) => value.trends.usersNew.push(1));
  refused((value) => (value.trends.recordsAdded[3] = -4));
});

test('company rows carry usage only and must name the company', () => {
  refused((value) => (value.companies[0].id = ''));
  refused((value) => delete value.companies[0].name);
  refused((value) => (value.companies[0].seatsUsed = 'four'));
  refused((value) => delete value.companies[1].lastActiveAt);
  const money = /fils|value|commission|amount/i;
  for (const key of Object.keys(sampleMetrics().companies[0])) assert.doesNotMatch(key, money);
});

test('websites live adds the general site; a null side stays untracked', () => {
  assert.equal(websitesLive({ companySitesLive: 5, generalSiteLive: true }), 6);
  assert.equal(websitesLive({ companySitesLive: 5, generalSiteLive: false }), 5);
  assert.equal(websitesLive({ companySitesLive: 5, generalSiteLive: 1 }), 6);
  assert.equal(websitesLive({ companySitesLive: null, generalSiteLive: true }), null);
  assert.equal(websitesLive({ companySitesLive: 2, generalSiteLive: null }), null);
});

test('a series total skips untracked months and is null when none is tracked', () => {
  assert.equal(seriesTotal([1, null, 2]), 3);
  assert.equal(seriesTotal([0, 0]), 0);
  assert.equal(seriesTotal([null, null]), null);
});

test('every figure row reads a value from a complete reply', () => {
  const metrics = sampleMetrics();
  const keys = figureSections.flatMap((section) => section.rows.map((row) => row.key));
  assert.equal(new Set(keys).size, keys.length);
  for (const section of figureSections)
    for (const row of section.rows) {
      const value = row.read(metrics);
      assert.ok(value === null || typeof value === 'number' || typeof value === 'boolean', row.key);
    }
  const outside = figureSections.find((section) => section.key === 'outside');
  assert.equal(outside.rows[1].read(metrics), null);
});
