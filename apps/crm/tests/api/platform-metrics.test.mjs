import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { query, request } from './helpers.mjs';
import { newCompany } from './company-helpers.mjs';
import { activate, invite, staffLogin } from './team-helpers.mjs';
import {
  earnedDeal,
  financeSettings,
  growth,
  metrics,
  metricsPath,
} from './platform-metrics-helpers.mjs';
import { assertShape, DAY, ISO } from './platform-metrics-shape.mjs';

before(() => query('TRUNCATE crm_login_limits'));

test('Blaqks One reads platform figures that grow with a new company, records and an earned deal', async () => {
  const owner = (await newCompany('metrics-base')).owner;
  const first = await metrics(owner);
  assertShape(first);
  assert.equal(first.period.key, '30d');
  assert.match(first.period.from, DAY);
  const span = (new Date(first.period.to) - new Date(first.period.from)) / 86_400_000;
  assert.equal(span, 29, 'thirty days including today');
  const { admin } = await newCompany('metrics-grow');
  await financeSettings(admin);
  await earnedDeal(admin, 245_000_000);
  await staffLogin(admin.email);
  const after = await metrics(owner);
  assertShape(after);
  const grew = growth(first, after, [
    'totals.companies.total',
    'totals.companies.active',
    'totals.users.admins',
    'totals.records.byType.Clients',
    'totals.records.total',
    'totals.deals.recorded',
    'totals.deals.earned',
    'totals.deals.earnedValueFils',
    'inPeriod.companiesNew',
    'inPeriod.usersNew',
    'inPeriod.recordsAdded',
    'inPeriod.dealsEarned',
    'inPeriod.dealsEarnedValueFils',
  ]);
  assert.deepEqual(
    Object.values(grew),
    [1, 1, 1, 1, 1, 1, 1, 245_000_000, 1, 1, 1, 1, 245_000_000],
  );
  assert.ok(after.totals.deals.commissionEarnedFils > first.totals.deals.commissionEarnedFils);
  assert.ok(after.inPeriod.signIns >= first.inPeriod.signIns + 1, 'the Admin signed in');
  assert.ok(after.totals.activeUsers.today >= 1);
  assert.equal(after.trends.dealsEarned.at(-1) - first.trends.dealsEarned.at(-1), 1);
  assert.equal(after.trends.companiesNew.at(-1) - first.trends.companiesNew.at(-1), 1);
  assert.notEqual(after.trends.monthlyActiveUsers.at(-1), null, 'tracked this month');
  const row = after.companies.find((company) => company.id === admin.user.workspaceId);
  assert.deepEqual(
    {
      status: row.status,
      seatsUsed: row.seatsUsed,
      seatLimit: row.seatLimit,
      records: row.records,
    },
    { status: 'active', seatsUsed: 1, seatLimit: 3, records: 1 },
  );
  assert.equal(row.admin, admin.user.name);
  assert.equal(row.activeUsers30d, 1);
  assert.match(row.lastActiveAt, ISO);
  assert.equal(
    after.companies.some((company) => company.id === owner.user.workspaceId),
    false,
  );
});

test('the period switch covers 30 days, twelve months and all time; anything else is refused', async () => {
  const { owner } = await newCompany('metrics-period');
  const year = await metrics(owner, '12m');
  assert.equal(year.period.key, '12m');
  assert.equal(year.period.from, `${year.trends.months[0]}-01`);
  const all = await metrics(owner, 'all');
  assert.equal(all.period.key, 'all');
  assert.match(all.period.from, DAY);
  assert.ok(all.period.from <= all.period.to);
  assert.ok(all.inPeriod.recordsAdded >= year.inPeriod.recordsAdded);
  assert.equal(all.inPeriod.companiesNew, all.totals.companies.total);
  assert.equal((await metrics(owner, '30d')).period.key, '30d');
  for (const wrong of ['7d', 'ALL', '', '30d&extra=1'])
    assert.equal((await owner.request(metricsPath(wrong))).status, 400, wrong);
  const refused = await owner.request(metricsPath('1y'));
  assert.equal(refused.value.code, 'invalid_request');
});

test('company Admins, staff and signed-out callers cannot read the platform figures', async () => {
  const { admin } = await newCompany('metrics-refused');
  const agent = await activate(await invite(admin, 'metrics-refused-agent'));
  for (const session of [admin, agent]) {
    const result = await session.request(metricsPath('30d'));
    assert.equal(result.status, 403);
    assert.deepEqual(result.value, { message: 'Access denied.', code: 'forbidden' });
  }
  assert.equal((await request(metricsPath())).status, 401);
});
