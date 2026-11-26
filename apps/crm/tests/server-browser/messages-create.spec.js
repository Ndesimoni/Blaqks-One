import { test, expect } from './fixtures.js';
import { signIn } from './helpers.js';

// The approved mockup's Messages Create: New email and New group live in the top bar, and
// each opens on its own page without staying in the address.
test('Create in Messages starts an email or a group chat', async ({ page }) => {
  await signIn(page);
  await page.goto('/#/inbox');
  const create = page.getByRole('banner').getByRole('button', { name: 'Create', exact: true });
  const panel = page.locator('#create-panel');
  await create.click();
  await expect(panel).toContainText('Create in Messages');
  await expect(panel.getByRole('button')).toHaveText(['Email', 'Group chat']);
  await expect(page.getByRole('region', { name: 'Conversations', exact: true })).not.toContainText(
    'New email',
  );
  await panel.getByRole('button', { name: 'Email', exact: true }).click();
  const writing = page.getByRole('dialog', { name: 'New email', exact: true });
  await expect(writing).toBeVisible();
  await expect(page).not.toHaveURL(/start=/);
  await page.keyboard.press('Escape');
  await expect(writing).toHaveCount(0);
  await create.click();
  await panel.getByRole('button', { name: 'Group chat', exact: true }).click();
  await expect(page).toHaveURL(/#\/team-chat$/);
  await expect(page.getByLabel('Group name (optional)')).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/#\/inbox$/);
  await expect(writing).toHaveCount(0);
});
