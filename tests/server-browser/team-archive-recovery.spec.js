import { test, expect } from './fixtures.js';
import { signIn } from './helpers.js';
import { closeInvitation, finishInvitation, openTeam, startInvitation } from './team-helpers.js';
import { clickMemberAction, teamCard } from './team-status-helpers.js';

test('a lost archive response can be checked without deleting twice or losing the saved account', async ({
  page,
}) => {
  await signIn(page, 'owner');
  await openTeam(page);
  const form = await startInvitation(page, 'archive-response');
  await form.getByRole('checkbox', { name: 'Receptionist', exact: true }).check();
  await finishInvitation(page, form);
  await closeInvitation(page);
  await page.getByLabel('Search team').fill('Browser archive-response');
  const card = teamCard(page, 'Browser archive-response');
  await clickMemberAction(page, 'Browser archive-response', 'Delete account for Browser archive-response');
  const dialog = page.getByRole('dialog', { name: 'Delete account', exact: true });
  await dialog
    .getByLabel('Type archive-response@browser-team.test to confirm')
    .fill('archive-response@browser-team.test');
  let committed = false;
  await page.route('**/api/crm/workspaces/*/team/*', async (route) => {
    if (route.request().method() !== 'DELETE') return route.continue();
    const response = await route.fetch();
    expect(response.status()).toBe(200);
    committed = true;
    await route.abort();
  });
  await dialog.getByRole('button', { name: 'Delete and archive' }).click();
  await expect(dialog.getByRole('alert')).toContainText('Close this review to refresh Team');
  expect(committed).toBe(true);
  await expect(dialog.getByRole('button', { name: 'Delete and archive' })).toBeDisabled();
  await dialog.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(card).toHaveCount(0);
  await page.getByRole('button', { name: 'Archived accounts', exact: true }).click();
  await expect(card).toContainText('Archived · Sign-in blocked');
  await expect(card.getByRole('button')).toHaveCount(0);
  await expect(card).toContainText('archive-response@browser-team.test');
});
