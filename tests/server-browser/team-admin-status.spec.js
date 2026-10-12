import { test, expect } from './fixtures.js';
import { signIn, addClient } from './helpers.js';
import {
  activateInNewContext,
  closeInvitation,
  finishInvitation,
  openTeam,
  startInvitation,
} from './team-helpers.js';
import {
  changeAccountStatus,
  expectSuspended,
  openMemberActions,
  signInActivatedMember,
  teamCard,
} from './team-status-helpers.js';
import { textContrast } from '../browser/helpers/contrast.js';

test('Super Admin suspends and restores an Admin and their staff from the account card', async ({
  page,
  browser,
}, testInfo) => {
  await signIn(page, 'owner');
  await openTeam(page);
  const form = await startInvitation(page, 'status-admin', true);
  const link = await finishInvitation(page, form);
  const admin = await activateInNewContext(browser, link, 'status-admin@browser-team.test');
  let staff;
  try {
    await addClient(admin.page, 'BROWSER-STATUS-CLIENT', 'Retained company client');
    await openTeam(admin.page);
    const staffForm = await startInvitation(admin.page, 'status-admin-staff');
    await staffForm.getByRole('checkbox', { name: 'Receptionist', exact: true }).check();
    const staffLink = await finishInvitation(admin.page, staffForm);
    staff = await activateInNewContext(browser, staffLink, 'status-admin-staff@browser-team.test');
    await closeInvitation(admin.page);
    await expect(staff.page.getByText('Retained company client', { exact: true })).toBeVisible();
    await closeInvitation(page);
    await page.reload();
    await page.getByLabel('Search team').fill('Browser status-admin');
    const card = teamCard(page, 'Browser status-admin');
    let actions = await openMemberActions(page, 'Browser status-admin');
    const suspend = actions.getByRole('button', {
      name: 'Suspend account for Browser status-admin',
    });
    await expect(suspend).toBeEnabled();
    await expect(actions.getByRole('button', { name: /Cancel invitation/ })).toHaveCount(0);
    await actions.getByRole('button', { name: 'Edit Browser status-admin', exact: true }).click();
    const edit = page.getByRole('dialog', { name: 'Edit teammate' });
    await expect(edit.getByLabel('Account active', { exact: true })).toHaveCount(0);
    await edit.getByRole('button', { name: 'Continue', exact: true }).click();
    await expect(edit.getByLabel('Account active', { exact: true })).toBeChecked();
    await edit.getByRole('button', { name: 'Close team form', exact: true }).click();
    await page.emulateMedia({ reducedMotion: 'reduce' });
    for (const width of [1440, 768, 390]) {
      await page.setViewportSize({ width, height: 900 });
      for (const theme of ['dark', 'light']) {
        if ((await page.locator('html').getAttribute('data-theme')) !== theme)
          await page.getByRole('button', { name: `Switch to ${theme} mode` }).click();
        actions = await openMemberActions(page, 'Browser status-admin');
        await suspend.scrollIntoViewIfNeeded();
        await expect(suspend).toBeVisible();
        await expect.poll(() => textContrast(suspend.locator('span'))).toBeGreaterThanOrEqual(4.5);
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
        ).toBe(true);
        await page.screenshot({ path: testInfo.outputPath(`team-status-${width}-${theme}.png`) });
        await actions.getByRole('button', { name: 'Close account actions' }).click();
      }
    }
    page.once('dialog', (confirmation) => confirmation.dismiss());
    await openMemberActions(page, 'Browser status-admin');
    await suspend.click();
    await expect(card).toContainText('Active');
    page.once('dialog', (confirmation) => {
      expect(confirmation.message()).toContain('Admin and their staff');
      confirmation.accept();
    });
    await openMemberActions(page, 'Browser status-admin');
    await suspend.click();
    await expect(card).toContainText('Suspended');
    actions = await openMemberActions(page, 'Browser status-admin');
    await expect(suspend).toHaveCount(0);
    await expect(actions.getByRole('button', { name: /Restore account/ })).toBeEnabled();
    await actions.getByRole('button', { name: 'Close account actions' }).click();
    await expectSuspended(admin.page, 'status-admin@browser-team.test');
    await expectSuspended(staff.page, 'status-admin-staff@browser-team.test');
    await page.reload();
    await page.getByLabel('Search team').fill('Browser status-admin');
    await expect(card).toContainText('Suspended');
    await changeAccountStatus(page, 'Browser status-admin', 'Restore');
    await signInActivatedMember(admin.page, 'status-admin@browser-team.test');
    await signInActivatedMember(staff.page, 'status-admin-staff@browser-team.test');
    await expect(admin.page.getByText('Retained company client', { exact: true })).toBeVisible();
    await expect(staff.page.getByText('Retained company client', { exact: true })).toBeVisible();
    await expect(staff.page.getByRole('button', { name: 'Team', exact: true })).toHaveCount(0);
  } finally {
    await staff?.context.close();
    await admin.context.close();
  }
});
