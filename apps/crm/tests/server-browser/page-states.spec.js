import { test, expect } from './fixtures.js';
import { assignTeam } from './assign-fixtures.js';
import { memberPage } from './assign-helpers.js';

const RECORDS = '**/api/crm/workspaces/*/records';

// Design queue item 38: the approved mockup's empty, loading, error and no-access pages.
test('pages show the mockup states: empty, loading, error and no access', async ({
  browser,
}, testInfo) => {
  test.setTimeout(150000);
  const team = await assignTeam('pstates');
  const { page, context } = await memberPage(browser, team.people.admin.email);
  const shot = (name) => page.screenshot({ path: testInfo.outputPath(`${name}.png`) });
  try {
    await page.setViewportSize({ width: 1280, height: 860 });
    // A list with nothing in it yet says so and offers the first record.
    await expect(page.getByRole('heading', { name: 'No clients yet', exact: true })).toBeVisible();
    await expect(page.getByText(/^Add a client and it appears here/)).toBeVisible();
    await shot('empty');
    await page.getByRole('button', { name: 'Add a client', exact: true }).click();
    await expect(page.getByRole('dialog', { name: 'New client', exact: true })).toBeVisible();
    await page.keyboard.press('Escape');

    // Loading shows the skeleton rows, named for screen readers.
    await page.route(RECORDS, async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 2500));
      await route.continue().catch(() => {});
    });
    await page.reload();
    await expect(page.getByRole('status', { name: 'Loading Clients', exact: true })).toBeVisible();
    await shot('loading');
    await page.unroute(RECORDS);

    // A failed load keeps the page calm: saved work is safe, and Try again.
    await page.route(RECORDS, (route) =>
      route.fulfill({ status: 503, contentType: 'application/json', body: '{}' }),
    );
    await page.reload();
    const failure = page.getByRole('alert').filter({ hasText: "Clients couldn't load" });
    await expect(failure).toContainText('Your saved work is safe.');
    await shot('error');
    await page.unroute(RECORDS);
    await failure.getByRole('button', { name: 'Try again', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'No clients yet', exact: true })).toBeVisible();
  } finally {
    await context.close();
  }

  // A page the member may not open says who decides and offers a page they can open.
  const staff = await memberPage(browser, team.people.one.email);
  try {
    await staff.page.setViewportSize({ width: 390, height: 844 });
    await staff.page.goto('/#/team-access');
    const heading = staff.page.getByRole('heading', {
      name: "You don't have access to Team & access",
    });
    await expect(heading).toBeVisible();
    await expect(staff.page.getByText(/^Your Admin decides which sections/)).toBeVisible();
    await staff.page.screenshot({ path: testInfo.outputPath('no-access-390.png') });
    await staff.page.getByRole('button', { name: /^Go to / }).click();
    await expect(heading).toHaveCount(0);
  } finally {
    await staff.context.close();
  }
});
