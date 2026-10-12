import { test, expect } from './fixtures.js';
import { clickMemberAction } from './team-status-helpers.js';
import { signIn } from './helpers.js';
import {
  activateInNewContext,
  closeInvitation,
  finishInvitation,
  openTeam,
  startInvitation,
} from './team-helpers.js';

test('renewing a pending invitation replaces its old link and activates the same account', async ({
  page,
  browser,
}) => {
  await signIn(page, 'admin-b');
  await openTeam(page);
  const dialog = await startInvitation(page, 'renewed-link');
  await dialog.getByRole('checkbox', { name: 'Receptionist', exact: true }).check();
  const original = await finishInvitation(page, dialog);
  await closeInvitation(page);
  await page.getByLabel('Search team').fill('Browser renewed-link');
  await clickMemberAction(
    page,
    'Browser renewed-link',
    'Renew invitation for Browser renewed-link',
  );
  const ready = page.getByRole('dialog', { name: 'Invitation ready' });
  await expect(ready).toBeVisible();
  const link = await ready.getByLabel('Activation link').inputValue();
  expect(link).not.toBe(original);
  const context = await browser.newContext();
  const rejected = await context.newPage();
  try {
    await rejected.goto(original);
    await expect(rejected.getByRole('alert')).toContainText('invitation is unavailable');
  } finally {
    await context.close();
  }
  const staff = await activateInNewContext(browser, link, 'renewed-link@browser-team.test');
  try {
    await expect(staff.page.getByRole('heading', { name: 'Clients & requirements' })).toBeVisible();
  } finally {
    await staff.context.close();
  }
  await closeInvitation(page);
});
