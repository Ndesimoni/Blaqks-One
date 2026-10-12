import { test, expect } from './fixtures.js';
import { signIn } from './helpers.js';
import { closeInvitation, finishInvitation, openTeam, startInvitation } from './team-helpers.js';
import { textContrast } from '../browser/helpers/contrast.js';

test('an Admin can cancel immediately, dismiss confirmation and renew the same pending member', async ({
  page,
  browser,
}, testInfo) => {
  await signIn(page, 'admin-b');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openTeam(page);
  const dialog = await startInvitation(page, 'cancelled-staff');
  await dialog.getByRole('checkbox', { name: 'Receptionist', exact: true }).check();
  const original = await finishInvitation(page, dialog);
  await closeInvitation(page);
  await page.getByLabel('Search team').fill('Browser cancelled-staff');
  const card = page.getByRole('article').filter({
    has: page.getByRole('heading', { name: 'Browser cancelled-staff', exact: true }),
  });
  const cancel = card.getByRole('button', {
    name: 'Cancel invitation for Browser cancelled-staff',
  });
  const renew = card.getByRole('button', { name: 'Renew invitation for Browser cancelled-staff' });
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    for (const theme of ['dark', 'light']) {
      if ((await page.locator('html').getAttribute('data-theme')) !== theme)
        await page.getByRole('button', { name: `Switch to ${theme} mode` }).click();
      await cancel.scrollIntoViewIfNeeded();
      await expect(cancel).toBeVisible();
      await expect(renew).toBeVisible();
      await expect.poll(() => textContrast(cancel.locator('span'))).toBeGreaterThanOrEqual(4.5);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
      ).toBe(true);
      await page.screenshot({ path: testInfo.outputPath(`team-cancel-${width}-${theme}.png`) });
    }
  }
  page.once('dialog', (confirmation) => confirmation.dismiss());
  await cancel.click();
  await expect(cancel).toBeEnabled();
  await expect(card).not.toContainText('Invitation cancelled');
  page.once('dialog', (confirmation) => {
    expect(confirmation.message()).toContain('stop working immediately');
    confirmation.accept();
  });
  await cancel.click();
  await expect(card).toContainText('Invitation cancelled');
  await expect(cancel).toHaveCount(0);
  await expect(renew).toBeEnabled();
  await page.reload();
  await page.getByLabel('Search team').fill('Browser cancelled-staff');
  await expect(card).toContainText('Invitation cancelled');
  const context = await browser.newContext();
  try {
    const invited = await context.newPage();
    await invited.goto(original);
    await expect(invited.getByRole('alert')).toContainText('invitation is unavailable');
  } finally {
    await context.close();
  }
  await renew.click();
  const ready = page.getByRole('dialog', { name: 'Invitation ready' });
  expect(await ready.getByLabel('Activation link').inputValue()).not.toBe(original);
  await closeInvitation(page);
  await expect(card).not.toContainText('Invitation cancelled');
  await expect(cancel).toBeEnabled();
});

test('the Super Admin can cancel an Admin invitation and failed requests keep it available to retry', async ({
  page,
}) => {
  await signIn(page, 'owner');
  await openTeam(page);
  const dialog = await startInvitation(page, 'cancelled-admin', true);
  await finishInvitation(page, dialog);
  await closeInvitation(page);
  await page.getByLabel('Search team').fill('Browser cancelled-admin');
  const card = page.getByRole('article').filter({
    has: page.getByRole('heading', { name: 'Browser cancelled-admin', exact: true }),
  });
  const cancel = card.getByRole('button', {
    name: 'Cancel invitation for Browser cancelled-admin',
  });
  await page.route('**/api/crm/workspaces/*/team/*', (route) =>
    route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ message: 'Cancellation could not be saved.' }),
    }),
  );
  page.once('dialog', (confirmation) => confirmation.accept());
  await cancel.click();
  await expect(page.getByRole('alert')).toContainText('Cancellation could not be saved.');
  await expect(cancel).toBeEnabled();
  await expect(card).not.toContainText('Invitation cancelled');
  await page.unroute('**/api/crm/workspaces/*/team/*');
  page.once('dialog', (confirmation) => confirmation.accept());
  await cancel.click();
  await expect(card).toContainText('Invitation cancelled');
  await expect(cancel).toHaveCount(0);
  await expect(page.getByRole('alert')).toHaveCount(0);
});
