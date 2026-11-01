import { offer } from '../api/record-sharing-helpers.mjs';
import { assignTeam, held } from './assign-fixtures.js';
import { memberPage } from './assign-helpers.js';
import { expect, test } from './fixtures.js';

test('the bell counts what waits for a member and opens the page that handles it', async ({
  browser,
}) => {
  const team = await assignTeam('bell');
  const { one, two } = team.people;
  const record = await held(team, 'Clients', { full_name: 'Bell shared client' }, one.id);
  const member = await memberPage(browser, two.email);
  try {
    const { page } = member;
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const header = page.getByRole('banner');
    await expect(header.getByRole('button', { name: 'Notifications', exact: true })).toBeVisible();
    await header.getByRole('button', { name: 'Notifications', exact: true }).click();
    const panel = page.getByRole('dialog', { name: 'Notifications' });
    await expect(panel.getByRole('status')).toContainText('You are all caught up');
    await page.keyboard.press('Escape');
    await expect(panel).toHaveCount(0);

    await offer(team.one, record, team.two);
    // Share counts are read once for every badge and reused for two seconds (waitingCounts.js);
    // the next page change after that reads the new share.
    await page.waitForTimeout(2_100);
    await page.goto('/#/contacts');
    const bell = header.getByRole('button', { name: 'Notifications, 1 waiting', exact: true });
    await expect(bell).toBeVisible();
    await expect(bell.locator('.header-badge')).toHaveText('1');
    await bell.click();
    const row = panel.getByRole('button', { name: /A colleague shared a client or lead with you/ });
    await expect(row).toContainText('Open Clients');
    await panel.getByRole('button', { name: 'Approvals', exact: true }).click();
    await expect(row).toHaveCount(0);
    await expect(panel.getByRole('status')).toContainText('Hand-overs, offers from other');
    await panel.getByRole('button', { name: 'All', exact: true }).click();
    await row.click();
    await expect(panel).toHaveCount(0);
    await expect(page).toHaveURL(/#\/clients/);
    await expect(bell).toBeFocused();
  } finally {
    await member.context.close();
  }
});
