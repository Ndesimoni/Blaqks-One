import { test, expect } from './fixtures.js';
import { session, signIn } from './helpers.js';
import { clearInbox, seedConversation } from './inbox-fixtures.js';
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
  const inbox = page.getByRole('dialog', { name: 'Client inbox' });
  await expect(inbox.getByRole('region', { name: 'Inbox' })).toBeVisible();
  await noPageOverflow(page);
  await page.keyboard.press('Escape');
  await expect(inbox).toHaveCount(0);
  // Focus returns to the button that opened the panel, even after switching boxes.
  await expect(page.getByRole('button', { name: /^Open Team chat/ })).toBeFocused();

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

test('Open full page stays on the conversation that was open in the panel', async ({ page }) => {
  await signIn(page);
  await page.getByRole('button', { name: /^Open Team chat/ }).click();
  const team = page.getByRole('dialog', { name: 'Team chat' });
  await team.getByRole('button', { name: /#general/ }).click();
  await expect(team.locator('.chat-room-pane')).toBeVisible();
  await team.getByRole('button', { name: 'Open full page', exact: true }).click();
  await expect(page).toHaveURL(/#\/team-chat\?room=/);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('.chat-room-pane')).toBeVisible();

  const workspace = (await session(page)).user.workspaceId;
  clearInbox(workspace);
  seedConversation(workspace, {
    name: 'Synthetic Full Page Client',
    messages: [{ body: 'Is the Marina flat still available?' }],
  });
  await page.getByRole('button', { name: /^Open the Client inbox/ }).click();
  const inbox = page.getByRole('dialog', { name: 'Client inbox' });
  await inbox.getByRole('tab', { name: /^Unassigned/ }).click();
  await inbox.getByRole('button', { name: /Synthetic Full Page Client/ }).click();
  await expect(inbox.locator('.inbox-thread')).toContainText('Marina flat');
  await inbox.getByRole('button', { name: 'Open full page', exact: true }).click();
  await expect(page).toHaveURL(/#\/inbox\?conversation=/);
  await expect(page.locator('.inbox-thread')).toContainText('Marina flat');
  clearInbox(workspace);
});

test('the Super Admin, who reads no company conversations, has no messenger', async ({ page }) => {
  await signIn(page, 'owner');
  await expect(page.getByRole('button', { name: /^Open the Client inbox/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^Open Team chat/ })).toHaveCount(0);
});
