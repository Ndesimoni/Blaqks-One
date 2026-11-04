import { test, expect } from './fixtures.js';
import { market } from '../api/marketplace-helpers.mjs';
import { client, postHeld, requestTeams } from '../api/marketplace-request-helpers.mjs';
import { memberPage } from './assign-helpers.js';

test('a broker reads and answers a marketplace chat from Messages', async ({ browser }) => {
  test.setTimeout(180000);
  const teams = await requestTeams('market-chats-ui');
  const request = await postHeld(teams.one, (await client(teams, 'one')).id);
  const started = await market(teams.agent, `/requests/${request.id}/conversations`, {
    method: 'POST',
    body: { body: 'Synthetic question about the move-in month.' },
  });
  expect(started.status).toBe(200);
  const poster = await memberPage(browser, teams.one.user.email);
  try {
    const { page } = poster;
    await page.goto('/#/marketplace-chats');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Marketplace chats');
    const row = page.getByRole('button', { name: new RegExp(teams.agent.user.name) });
    await expect(row).toContainText('Your request');
    await expect(row).toContainText('Synthetic question about the move-in month.');
    await row.click();
    await expect(page).toHaveURL(/chat=/);
    const thread = page.getByRole('region', { name: teams.agent.user.name, exact: true });
    await expect(thread).toContainText('Synthetic question about the move-in month.');
    await thread.getByRole('textbox').fill('Synthetic answer: early next month.');
    await thread.getByRole('button', { name: 'Send message', exact: true }).click();
    await expect(thread).toContainText('Synthetic answer: early next month.');
    // Closed holds chats whose request no longer takes messages.
    await page
      .getByRole('group', { name: 'Filter marketplace chats', exact: true })
      .getByRole('button', { name: 'Closed', exact: true })
      .click();
    await expect(page.getByText('No chats here.', { exact: false })).toBeVisible();
  } finally {
    await poster.context.close();
  }
});
