import { test, expect } from './fixtures.js';
import {
  activityTeam,
  busyDay,
  checkLayout,
  layouts,
  memberPage,
  openActivity,
  phrases,
} from './activity-fixtures.js';

// Each scenario builds a finance team through the API first (several password hashes).
test.describe.configure({ timeout: 120_000 });

test('an Admin reviews team activity with filters in the URL and Load more', async ({
  browser,
}, testInfo) => {
  // A retry builds its own team, since invitation emails are unique.
  const prefix = `act-admin${testInfo.retry ? `-r${testInfo.retry}` : ''}`;
  const team = await activityTeam(prefix);
  busyDay(team, 55);
  const { page, context } = await memberPage(browser, team.people.admin.email);
  const nav = page.getByRole('navigation', { name: 'CRM sections', exact: true });
  await expect(nav.getByRole('button', { name: 'Team activity', exact: true })).toBeVisible();
  const feed = await openActivity(page, 'Team activity');
  await expect(feed.getByRole('heading', { name: /^Today/ })).toBeVisible();
  await expect(feed.locator('.activity-row')).toHaveCount(50);
  await feed.getByRole('button', { name: 'Load more activity' }).click();
  await expect(feed.getByText("You've reached the start of this date range.")).toBeVisible();
  const all = await phrases(feed);
  const agent = team.people.agent.name;
  expect(all).toContain(`${agent} added client Synthetic ${prefix} kept client`);
  expect(all).toContain(`${agent} added client Synthetic ${prefix} moved client`);
  expect(all).toContain(`${agent} added deal ${team.deal.dealId}`);
  expect(all).toContain(`You invited ${agent}`);
  expect(all.join(' ')).not.toMatch(/245|AED|Synthetic deal/);

  await page.getByLabel('Type', { exact: true }).selectOption('team');
  await expect(page).toHaveURL(/type=team/);
  await expect(page.getByLabel('CRM section', { exact: true })).toBeDisabled();
  await expect(feed.locator('.activity-row').first()).toBeVisible();
  for (const text of await phrases(feed)) expect(text).not.toMatch(/ client | deal /);
  await page.getByLabel('Action', { exact: true }).selectOption('suspended');
  await expect(page).toHaveURL(/action=suspended/);
  await expect(page.getByText('No matching activity')).toBeVisible();
  await page.getByRole('button', { name: 'Clear filters' }).first().click();
  await expect(page).not.toHaveURL(/type=|action=/);
  await expect(feed.locator('.activity-row')).toHaveCount(50);
  await page.getByLabel('Member', { exact: true }).selectOption({ label: agent });
  await expect(page).toHaveURL(/member=/);
  await expect(feed.locator('.activity-row').first()).toBeVisible();
  for (const text of await phrases(feed)) expect(text.startsWith(`${agent} `)).toBe(true);
  await page.getByLabel('From', { exact: true }).fill('2026-10-10');
  await page.getByLabel('To', { exact: true }).fill('2026-10-01');
  await expect(page.getByRole('alert')).toContainText('on or after the start date');
  await page.goto('/#/team-activity');
  await openActivity(page, 'Team activity');
  for (const layout of layouts) await checkLayout(page, layout, 'activity-admin');
  await context.close();
});

test('staff read My activity: only their own actions, with unavailable records', async ({
  browser,
}, testInfo) => {
  const prefix = `act-own${testInfo.retry ? `-r${testInfo.retry}` : ''}`;
  const team = await activityTeam(prefix);
  const { page, context } = await memberPage(browser, team.people.agent.email);
  const nav = page.getByRole('navigation', { name: 'CRM sections', exact: true });
  await expect(nav.getByRole('button', { name: 'My activity', exact: true })).toBeVisible();
  await expect(nav.getByRole('button', { name: 'Team activity', exact: true })).toHaveCount(0);
  const feed = await openActivity(page, 'My activity');
  await expect(page.getByText('Your actions', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Member', { exact: true })).toHaveCount(0);
  await expect(page.getByLabel('Type', { exact: true })).toHaveCount(0);
  const all = await phrases(feed);
  expect(all.every((text) => text.startsWith('You '))).toBe(true);
  expect(all).toContain(`You added client Synthetic ${prefix} kept client`);
  expect(all).toContain(`You added deal ${team.deal.dealId}`);
  expect(all.some((text) => /^You added a client\s*Record unavailable$/.test(text))).toBe(true);
  expect(all.join(' ')).not.toContain('moved client');
  expect(all.join(' ')).not.toContain('invited');
  await expect(feed.locator('.activity-unavailable')).toHaveCount(1);
  for (const layout of layouts) await checkLayout(page, layout, 'activity-own');
  // On phones the fields fold behind Filters and keep their values.
  await expect(page.getByLabel('CRM section', { exact: true })).toBeHidden();
  const toggle = page.getByRole('button', { name: 'Filters', exact: true });
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await checkLayout(page, layouts[2], 'activity-own-filters');
  await page.setViewportSize({ width: 1280, height: 900 });

  await page.getByLabel('CRM section', { exact: true }).selectOption('Deals');
  await expect(page).toHaveURL(/section=Deals/);
  await expect(feed.locator('.activity-row')).toHaveCount(1);
  await page.goto('/#/team-activity?section=Messages');
  await expect(page.getByText("This activity isn't available to you")).toBeVisible();
  await context.close();
});
