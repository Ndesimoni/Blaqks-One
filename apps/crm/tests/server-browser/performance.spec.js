import { test, expect } from './fixtures.js';
import { targetsPath } from '../api/performance-helpers.mjs';
import {
  aed,
  checkLayout,
  goal,
  layouts,
  memberPage,
  openPerformance,
  performanceTeam,
} from './performance-fixtures.js';

test('the Admin sets a member’s targets and the member reads them with their own actuals', async ({
  browser,
}) => {
  const team = await performanceTeam('perf-ui');
  const { admin, agent, month, commission } = team;
  expect(commission).toBeGreaterThan(0);

  const adminPage = await memberPage(browser, team.people.admin.email);
  const goals = await openPerformance(adminPage.page, month);
  await expect(goals.getByText('Team targets · automatic actuals')).toBeVisible();
  await adminPage.page.getByLabel('Assigned to').selectOption({ label: team.people.agent.name });
  await expect(goals.getByText('Member targets · automatic actuals')).toBeVisible();
  const save = async (metric, label, value) => {
    const row = goal(goals, metric);
    await row.getByLabel(`Target for ${label}`).fill(value);
    await row.getByRole('button', { name: 'Save target' }).click();
    await expect(row.getByRole('button', { name: 'Save target' })).toBeDisabled();
    await expect(row.getByRole('alert')).toHaveCount(0);
  };
  await save('enquiries', 'New enquiries', '4');
  await save('fees', 'Earned fees', '1000');
  await expect(goal(goals, 'enquiries')).toContainText('25% of target achieved');
  const stored = await agent.request(targetsPath(admin.user.workspaceId, `?month=${month}`));
  const values = Object.fromEntries(stored.value.targets.map((row) => [row.metric, row.value]));
  expect(values).toEqual({ enquiries: 4, fees: 100_000 });
  expect(stored.value.targets.every((row) => row.memberId === agent.user.id)).toBe(true);
  await adminPage.context.close();

  const agentPage = await memberPage(browser, team.people.agent.email);
  const own = await openPerformance(agentPage.page, month);
  await expect(own.getByText('Targets set by your Admin · automatic actuals')).toBeVisible();
  await expect(agentPage.page.getByLabel('Assigned to')).toHaveCount(0);
  await expect(own.getByRole('textbox')).toHaveCount(0);
  await expect(own.getByRole('button', { name: 'Save target' })).toHaveCount(0);
  await expect(goal(own, 'enquiries').locator('.goal-figures')).toHaveText('1 / 4');
  await expect(goal(own, 'fees').locator('.goal-figures')).toHaveText(
    `${aed(commission)} / ${aed(100_000)}`,
  );
  await expect(goal(own, 'deals')).toBeVisible();
  for (const layout of layouts) await checkLayout(agentPage.page, layout, 'performance-own');
  await agentPage.page.goto('/#/crm-insights');
  await expect(agentPage.page.getByRole('region', { name: 'Active pipelines' })).toBeVisible();
  await agentPage.context.close();
});

test('a member without finance access never sees deal or fee figures', async ({ browser }) => {
  const team = await performanceTeam('perf-ui-nofin');
  const { lead, month } = team;
  await team.setTarget(lead.user.id, 'viewings', 3);
  await team.setTarget(lead.user.id, 'fees', 500_000);
  const leadPage = await memberPage(browser, team.people.lead.email);
  const goals = await openPerformance(leadPage.page, month);
  await expect(goal(goals, 'viewings').locator('.goal-figures')).toHaveText('0 / 3');
  await expect(goal(goals, 'fees')).toHaveCount(0);
  await expect(goal(goals, 'deals')).toHaveCount(0);
  const page = leadPage.page;
  await expect(page.getByRole('region', { name: 'Fee earnings by month' })).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'New enquiries by month' })).toBeVisible();
  await expect(page.locator('main')).not.toContainText('AED');
  await expect(page.locator('main')).not.toContainText('Earned fees');
  for (const layout of layouts.slice(2)) await checkLayout(page, layout, 'performance-no-finance');
  await page.goto('/#/crm-insights');
  await expect(page.getByRole('region', { name: 'Lead quality distribution' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Active pipelines' })).toHaveCount(0);
  await leadPage.context.close();
});
