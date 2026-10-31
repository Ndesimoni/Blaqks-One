import { test, expect } from './fixtures.js';
import { signIn } from './helpers.js';
import { noPageOverflow } from './assign-helpers.js';

test('the slide-in messenger opens Team chat and the Inbox over any page', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await signIn(page);
  const address = page.url();
  await page.getByRole('button', { name: /^Open Team chat/ }).click();
  const panel = page.getByRole('dialog', { name: 'Team chat' });
  await expect(panel).toBeVisible();
  // One pane at a time: the room list, then the room with its Back button.
  await panel.getByRole('button', { name: /#general/ }).click();
  await expect(panel.locator('.chat-room-pane')).toBeVisible();
  await expect(panel.locator('.chat-list')).toBeHidden();
  // The page behind keeps its own address while the panel holds the open room.
  expect(page.url()).toBe(address);

  await panel.getByRole('button', { name: 'Client inbox', exact: true }).click();
  const inbox = page.getByRole('dialog', { name: 'Inbox' });
  await expect(inbox.getByRole('region', { name: 'Inbox' })).toBeVisible();
  await noPageOverflow(page);
  await page.keyboard.press('Escape');
  await expect(inbox).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^Open the Client inbox/ })).toBeFocused();

  await page.getByRole('button', { name: /^Open the Client inbox/ }).click();
  await page.getByRole('button', { name: 'Open full page', exact: true }).click();
  await expect(page).toHaveURL(/#\/inbox$/);
  await expect(page.getByRole('dialog')).toHaveCount(0);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: /^Open Team chat/ }).click();
  await expect(page.getByRole('dialog', { name: 'Team chat' })).toBeVisible();
  await noPageOverflow(page);
  expect(errors).toEqual([]);
});

test('the Super Admin, who reads no company conversations, has no messenger', async ({ page }) => {
  await signIn(page, 'owner');
  await expect(page.getByRole('button', { name: /^Open the Client inbox/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^Open Team chat/ })).toHaveCount(0);
});
