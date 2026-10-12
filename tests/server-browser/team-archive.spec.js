import { test, expect } from './fixtures.js';
import { signIn, addClient, session } from './helpers.js';
import {
  activateInNewContext,
  closeInvitation,
  finishInvitation,
  openTeam,
  startInvitation,
} from './team-helpers.js';
import { expectSuspended, openMemberActions, teamCard } from './team-status-helpers.js';
import { textContrast } from '../browser/helpers/contrast.js';

test('Super Admin deletes an Admin into a read-only archive with their team and all records', async ({
  page,
  browser,
}, testInfo) => {
  test.setTimeout(60000);
  await signIn(page, 'owner');
  await openTeam(page);
  const form = await startInvitation(page, 'archive-admin', true);
  const link = await finishInvitation(page, form);
  const admin = await activateInNewContext(browser, link, 'archive-admin@browser-team.test');
  let staff;
  try {
    await addClient(admin.page, 'ARCHIVED-BROWSER-CLIENT', 'Archived company client');
    await openTeam(admin.page);
    const staffForm = await startInvitation(admin.page, 'archive-staff');
    await staffForm.getByRole('checkbox', { name: 'Receptionist', exact: true }).check();
    const staffLink = await finishInvitation(admin.page, staffForm);
    staff = await activateInNewContext(browser, staffLink, 'archive-staff@browser-team.test');
    await closeInvitation(admin.page);
    const staffActions = await openMemberActions(admin.page, 'Browser archive-staff');
    await expect(staffActions.getByRole('button', { name: /Delete account/ })).toHaveCount(0);
    await staffActions.getByRole('button', { name: 'Close account actions' }).click();
    const adminStatus = admin.page.getByLabel('Account status');
    await expect(adminStatus.locator('option')).toHaveCount(5);
    await expect(adminStatus.locator('option[value="archived"]')).toHaveCount(0);
    await closeInvitation(page);
    await page.reload();
    await page.getByLabel('Search team').fill('Browser archive-admin');
    const card = teamCard(page, 'Browser archive-admin');
    const more = card.getByRole('button', { name: 'More actions for Browser archive-admin' });
    const actions = await openMemberActions(page, 'Browser archive-admin');
    const remove = actions.getByRole('button', {
      name: 'Delete account for Browser archive-admin',
    });
    await remove.click();
    const dialog = page.getByRole('dialog', { name: 'Delete account', exact: true });
    const confirm = dialog.getByRole('button', { name: 'Delete and archive', exact: true });
    await expect(dialog).toContainText('1 also archived');
    await expect(dialog).toContainText('1 retained');
    await expect(confirm).toBeDisabled();
    await dialog.getByLabel('Type archive-admin@browser-team.test to confirm').fill('wrong');
    await expect(confirm).toBeDisabled();
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(more).toBeFocused();
    await openMemberActions(page, 'Browser archive-admin');
    await remove.click();
    await expect(dialog).toContainText('1 retained');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    for (const width of [1440, 768, 390]) {
      await page.setViewportSize({ width, height: 900 });
      for (const theme of ['dark', 'light']) {
        await page.evaluate((value) => (document.documentElement.dataset.theme = value), theme);
        await dialog
          .getByLabel('Type archive-admin@browser-team.test to confirm')
          .fill('archive-admin@browser-team.test');
        await expect(confirm).toBeEnabled();
        await expect.poll(() => textContrast(confirm.locator('span'))).toBeGreaterThanOrEqual(4.5);
        const box = await dialog.boundingBox();
        expect(box.width).toBeLessThanOrEqual(width);
        expect(box.x).toBeGreaterThanOrEqual(-1);
        await page.screenshot({ path: testInfo.outputPath(`archive-${width}-${theme}.png`) });
      }
    }
    await page.route('**/api/crm/workspaces/*/team/*', async (route) => {
      if (route.request().method() === 'DELETE') {
        await route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'Temporary archive failure. Please retry.' }),
        });
      } else await route.continue();
    });
    await confirm.click();
    await expect(dialog.getByRole('alert')).toContainText('Temporary archive failure');
    await expect(confirm).toBeDisabled();
    await page.unroute('**/api/crm/workspaces/*/team/*');
    await dialog.getByRole('button', { name: 'Review again' }).click();
    await dialog
      .getByLabel('Type archive-admin@browser-team.test to confirm')
      .fill('archive-admin@browser-team.test');
    const identity = await session(admin.page);
    await confirm.click();
    await expect(dialog).toHaveCount(0);
    await expect(card).toHaveCount(0);
    await expectSuspended(admin.page, 'archive-admin@browser-team.test');
    await expectSuspended(staff.page, 'archive-staff@browser-team.test');
    await page.getByLabel('Account status').selectOption('archived');
    await expect(card).toContainText('Archived · Sign-in blocked');
    await expect(card.getByRole('button')).toHaveCount(0);
    await card.getByRole('link', { name: 'View archived records' }).click();
    await expect(page.getByText('ARCHIVED WORKSPACE · READ-ONLY', { exact: true })).toBeVisible();
    await expect(page.getByText('Archived company client', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Add client', exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Import saved records' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Open record ARCHIVED-BROWSER-CLIENT' }).click();
    const details = page.getByRole('dialog');
    await expect(details.getByRole('button', { name: /Edit record|Delete/ })).toHaveCount(0);
    await details.getByRole('button', { name: 'Close', exact: true }).click();
    await page.goto(`/#/team-access?workspace=${identity.user.id}`);
    await expect(teamCard(page, 'Browser archive-staff')).toContainText(
      'Archived · Sign-in blocked',
    );
    const frozenStatus = page.getByLabel('Account status');
    await expect(frozenStatus).toBeDisabled();
    await expect(frozenStatus).toHaveValue('archived');
    await expect(frozenStatus.locator('option')).toHaveText([/^Archived \(\d+\)$/]);
    await expect(
      page.getByRole('button', {
        name: /Invite teammate|Renew invitation|Restore account|Edit Browser/,
      }),
    ).toHaveCount(0);
  } finally {
    await staff?.context.close();
    await admin.context.close();
  }
});
