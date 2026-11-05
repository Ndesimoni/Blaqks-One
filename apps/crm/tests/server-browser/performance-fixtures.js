import { expect } from '@playwright/test';
import { query } from '../api/helpers.mjs';
import { activate, invite } from '../api/team-helpers.mjs';
import { createDeal, earnDeal, overview } from '../api/finance-deals-helpers.mjs';
import { targetBody, targetsPath } from '../api/performance-helpers.mjs';
import { financeDealTeam } from './finance-deals-fixtures.js';

export { aed, checkLayout, layouts, memberPage } from './finance-deals-fixtures.js';

/** The current month in Asia/Dubai, as the database (and every earned date) sees it. */
export const dubaiMonth = () =>
  query(`SELECT to_char((now() AT TIME ZONE 'Asia/Dubai')::date,'YYYY-MM')`);

/**
 * A fresh finance team through the API: the own-view agent holds one client added this month
 * and one deal the Admin earned today; a Lead Manager has reports but no finance access.
 */
export async function performanceTeam(prefix) {
  const team = await financeDealTeam(prefix);
  const { admin, agent } = team;
  const today = query(`SELECT ((now() AT TIME ZONE 'Asia/Dubai')::date)::text`);
  const client = await agent.request(`/workspaces/${admin.user.workspaceId}/records/Clients`, {
    method: 'POST',
    body: { record: { full_name: 'Synthetic performance client', date_added: today } },
  });
  if (client.status !== 201) throw Error(JSON.stringify(client.value));
  const deal = await createDeal(agent, client.value.record.client_id, {}, admin);
  await earnDeal(admin, deal);
  const month = dubaiMonth();
  const own = await overview(agent, admin);
  const commission = own.statement.lines
    .filter((line) => line.earnedOn.startsWith(month))
    .reduce((sum, line) => sum + line.amountFils, 0);
  const lead = await activate(
    await invite(admin, `${prefix}-lead`, { positions: ['lead-manager'] }),
  );
  const setTarget = async (memberId, metric, value) => {
    const result = await admin.request(targetsPath(admin.user.workspaceId), {
      method: 'PUT',
      body: targetBody({ month, memberId, metric, value }),
    });
    if (result.status !== 200) throw Error(JSON.stringify(result.value));
  };
  return {
    ...team,
    lead,
    month,
    commission,
    setTarget,
    people: { ...team.people, lead: { email: `${prefix}-lead@team-fixture.test` } },
  };
}

/** Opens Performance for `month` and waits for targets to load. */
export async function openPerformance(page, month) {
  await page.goto('/#/performance');
  await expect(page.getByRole('region', { name: /connection status/ })).toHaveCount(0);
  await page.getByLabel('Performance month').fill(month);
  const goals = page.getByRole('region', { name: 'Monthly goals' });
  await expect(goals.getByText('Loading targets…')).toHaveCount(0);
  return goals;
}

export const goal = (goals, metric) => goals.locator(`.goal[data-metric="${metric}"]`);
