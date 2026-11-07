import { test, expect } from './fixtures.js';
import { signIn } from './helpers.js';
import { setTheme } from './assign-helpers.js';

const noAccess = (page) => page.getByRole('heading', { name: /^You don't have access to / });

/** Joins from the invitation link in a fresh browser and lands on the start page. */
async function join(browser, link) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(link);
  await expect(page.getByRole('heading', { name: /^Join / })).toBeVisible({ timeout: 15_000 });
  await page.getByLabel('Choose a password').fill('Team123!');
  await page.getByLabel('Confirm password').fill('Team123!');
  await page.getByRole('button', { name: 'Join the team', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1, name: /^Good / })).toBeVisible();
  return { context, page };
}

// BO1b (docs/blaqks-one-console.md §8): a role fills the ticks, the ticks decide, and nobody on
// the Blaqks One team opens a company page.
test('the Owner invites an Analyst who opens only the areas ticked, then widens them', async ({
  page,
  browser,
}, testInfo) => {
  test.setTimeout(150000);
  const email = `analyst-${Date.now()}@browser-team.test`;
  await signIn(page, 'owner');
  await setTheme(page, 'light');
  await page.goto('/#/blaqks-one-team');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Blaqks One team');
  await page.getByRole('button', { name: 'Invite a team member', exact: true }).click();
  const form = page.getByRole('dialog', { name: 'Invite a team member' });
  await form.getByLabel('Full name').fill('Synthetic Analyst');
  await form.getByLabel('Email address').fill(email);
  await form.getByLabel('Phone number').fill('+971501234567');
  await form.getByLabel('Position').selectOption('analyst');
  const level = (dialog, area, name) =>
    dialog.getByRole('radiogroup', { name: area, exact: true }).getByRole('radio', { name });
  await expect(level(form, 'Dashboard', 'View')).toBeChecked();
  await expect(level(form, 'Companies', 'Off')).toBeChecked();
  await page.screenshot({ path: testInfo.outputPath('invite-light.png') });
  await form.getByRole('button', { name: 'Create invitation', exact: true }).click();
  const ready = page.getByRole('dialog', { name: 'Invitation ready' });
  const link = await ready.getByLabel('Activation link').inputValue();
  page.once('dialog', (dialog) => dialog.accept());
  await ready.getByRole('button', { name: 'Done', exact: true }).click();
  const list = page.getByRole('list', { name: 'Blaqks One team' });
  await expect(list).toContainText('Synthetic Analyst');
  const analyst = await join(browser, link);
  try {
    await analyst.page.goto('/#/platform-dashboard');
    await expect(analyst.page.getByRole('heading', { level: 1 })).toHaveText('Dashboard');
    for (const path of ['/workspaces', '/blaqks-one-team', '/clients']) {
      await analyst.page.goto(`/#${path}`);
      await expect(noAccess(analyst.page)).toBeVisible();
    }
    // The Owner widens the access; the next page load follows the saved ticks.
    await page.reload();
    await list.getByRole('button', { name: 'Edit access Synthetic Analyst', exact: true }).click();
    const edit = page.getByRole('dialog', { name: 'Edit access for Synthetic Analyst' });
    await level(edit, 'Companies', 'View').check();
    await edit.getByRole('button', { name: 'Save access', exact: true }).click();
    await expect(page.locator('.toast')).toContainText('Access saved for Synthetic Analyst');
    await expect(list).toContainText('Companies · View');
    await page.screenshot({ path: testInfo.outputPath('team-light.png') });
    await analyst.page.goto('/#/start');
    await analyst.page.reload();
    await analyst.page.goto('/#/workspaces');
    await expect(analyst.page.getByRole('table', { name: 'Companies' })).toBeVisible();
    // View on Companies shows a company's people but none of the Manage controls.
    await analyst.page
      .getByRole('table', { name: 'Companies' })
      .getByRole('button', { name: /^Open / })
      .first()
      .click();
    await expect(analyst.page.getByRole('region', { name: 'People' })).toBeVisible();
    await expect(analyst.page.getByRole('button', { name: /^Suspend / })).toHaveCount(0);
    await expect(analyst.page.getByRole('button', { name: 'Change seat limit' })).toHaveCount(0);
  } finally {
    await analyst.context.close();
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await setTheme(page, 'dark');
  await page.screenshot({ path: testInfo.outputPath('team-390-dark.png') });
});
