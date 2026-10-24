import { query } from '../api/helpers.mjs';
import { client, requestTeams } from '../api/marketplace-request-helpers.mjs';
import { shots } from './agreements-helpers.js';
import { openSection, password } from './assign-helpers.js';
import { expect, test } from './fixtures.js';

// Broker marketplace MK2 (docs/broker-marketplace.md §3 and §17): a member posts a client request,
// another company's member sees it on the board and opens the broker's profile, and the poster
// renews then closes it.

/**
 * Signs a member in through the real form. This machine opens the shell slowly, so the member
 * gets a minute to reach the signed-in state, retrying the visit once rather than weakening the
 * check.
 */
async function openMember(browser, email) {
  const context = await browser.newContext();
  const page = await context.newPage();
  const signOut = page.getByRole('button', { name: 'Sign out', exact: true });
  for (let attempt = 0; attempt < 2; attempt += 1) {
    await page.goto('/');
    try {
      await page.getByLabel('Email address').waitFor({ timeout: 30000 });
      await page.getByLabel('Email address').fill(email);
      await page.getByLabel('Password', { exact: true }).fill(password);
      await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    } catch {
      // The shell may already be past the form; the check below decides.
    }
    try {
      await expect(signOut).toBeVisible({ timeout: 60000 });
      return { context, page };
    } catch {
      // One more visit before calling it a failure.
    }
  }
  await expect(signOut).toBeVisible({ timeout: 60000 });
  return { context, page };
}

test('a request is posted, seen by another company, renewed and closed', async ({
  browser,
}, testInfo) => {
  test.setTimeout(300000);
  const teams = await requestTeams('market-browser');
  const record = await client(teams, 'one');
  const poster = await openMember(browser, teams.one.user.email);
  const viewer = await openMember(browser, teams.agent.user.email);
  try {
    await openSection(poster.page, 'Marketplace');
    await expect(poster.page.getByRole('tab', { name: 'My requests' })).toBeVisible({
      timeout: 30000,
    });
    await poster.page.getByRole('tab', { name: 'My requests' }).click();
    await poster.page.getByRole('button', { name: 'Post a request' }).click();
    await poster.page.locator('.market-client', { hasText: record.record.full_name }).click();
    await expect(poster.page.getByLabel('Budget up to (AED)')).toHaveValue('120000');
    await shots(poster.page, testInfo, 'marketplace-request-form');
    await poster.page.getByRole('checkbox', { name: /My client agreed/ }).check();
    await poster.page.getByRole('button', { name: 'Post request', exact: true }).click();
    await expect(poster.page.getByText('Your request is on the board.')).toBeVisible({
      timeout: 30000,
    });
    await expect(poster.page.getByText('Synthetic Request Client').first()).toBeVisible();
    await shots(poster.page, testInfo, 'marketplace-my-requests');

    await openSection(viewer.page, 'Marketplace');
    const card = viewer.page.locator('.market-board-card').first();
    await expect(card).toContainText('Dubai Marina', { timeout: 30000 });
    await expect(card).toContainText(teams.one.user.name);
    // The other company never sees who the client is.
    await expect(viewer.page.getByText(record.record.full_name)).toHaveCount(0);
    await shots(viewer.page, testInfo, 'marketplace-board');
    await viewer.page.getByLabel('Emirate', { exact: true }).selectOption('sharjah');
    await expect(viewer.page.getByText('No requests match these filters yet.')).toBeVisible();
    await viewer.page.getByLabel('Emirate', { exact: true }).selectOption('');
    await expect(card).toContainText('Dubai Marina');
    await viewer.page.locator('.market-broker').first().click();
    const dialog = viewer.page.getByRole('dialog');
    await expect(dialog).toContainText(teams.one.user.name);
    await expect(dialog).toContainText('Dubai Marina');
    await shots(viewer.page, testInfo, 'marketplace-broker-profile');
    await dialog.getByRole('button', { name: 'Close', exact: true }).click();

    // The last week offers Renew, so the fixture moves the request close to its end first.
    query(
      `UPDATE marketplace.crm_market_requests SET expires_at=now()+interval '3 days' ` +
        `WHERE member_id='${teams.one.user.id}'`,
    );
    await poster.page.reload();
    await poster.page.getByRole('tab', { name: 'My requests' }).click();
    await poster.page.getByRole('button', { name: 'Renew', exact: true }).click();
    await expect(poster.page.getByText(/^Renewed: the request stays on the board/)).toBeVisible({
      timeout: 30000,
    });
    await shots(poster.page, testInfo, 'marketplace-request-renewed');
    await poster.page.getByRole('button', { name: 'Close', exact: true }).click();
    const confirm = poster.page.getByRole('dialog');
    await expect(confirm).toContainText('It leaves the board and frees the client.');
    await confirm.getByRole('button', { name: 'Close request', exact: true }).click();
    await expect(poster.page.getByText('Request closed.')).toBeVisible({ timeout: 30000 });
    await expect(poster.page.getByText('Closed', { exact: true }).first()).toBeVisible();
    await shots(poster.page, testInfo, 'marketplace-request-closed');
  } finally {
    await poster.context.close();
    await viewer.context.close();
  }
});
