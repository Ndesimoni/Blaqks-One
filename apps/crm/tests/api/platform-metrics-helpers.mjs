import assert from 'node:assert/strict';
import { query } from './helpers.mjs';
import { createDeal, earnDeal, heldClient } from './finance-deals-helpers.mjs';
import { financePath, settingsBody } from './finance-helpers.mjs';

/** Blaqks One's dashboard (BO1d); `period` is sent as given, or left out. */
export const metricsPath = (period) =>
  `/platform/metrics${period === undefined ? '' : `?period=${period}`}`;

export async function metrics(session, period) {
  const result = await session.request(metricsPath(period));
  assert.equal(result.status, 200, JSON.stringify(result.value));
  return result.value;
}

/** The number at a dotted `path` ("totals.deals.earned"). */
export const at = (value, path) => path.split('.').reduce((node, key) => node?.[key], value);

/** How much each dotted path grew between two dashboard readings. */
export const growth = (before, after, paths) =>
  Object.fromEntries(paths.map((path) => [path, at(after, path) - at(before, path)]));

/** Saves synthetic finance settings for the Admin's company (earning needs them). */
export async function financeSettings(admin) {
  const saved = await admin.request(financePath(admin, '/settings'), {
    method: 'PUT',
    body: settingsBody({ agentShareBp: 5000 }),
  });
  assert.equal(saved.status, 200, JSON.stringify(saved.value));
}

/** A synthetic client with one deal of `value` fils, earned today by the Admin. */
export async function earnedDeal(admin, value, clientId) {
  const client = clientId ?? (await heldClient(admin));
  const deal = await createDeal(admin, client, { agreedValueFils: value });
  return earnDeal(admin, deal);
}

/** Platform events as rows, newest first, for a SQL condition. */
export const events = (where) =>
  JSON.parse(
    query(`SELECT COALESCE(jsonb_agg(jsonb_build_object('event',event,
      'workspace',workspace_id,'role',actor_role,'source',source,'amount',amount_fils)
      ORDER BY id DESC),'[]') FROM platform_metrics.crm_platform_events WHERE ${where}`),
  );

/** Active-day rows for one person. */
export const activeDays = (userId) =>
  Number(
    query(`SELECT count(*) FROM platform_metrics.crm_user_active_days WHERE user_id='${userId}'`),
  );

/** Today's month in Asia/Dubai, as the database sees it. */
export const thisMonth = () => query(`SELECT to_char(now() AT TIME ZONE 'Asia/Dubai','YYYY-MM')`);
