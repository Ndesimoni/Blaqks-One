import { test, expect } from './fixtures.js';
import { signIn, session } from './helpers.js';
import { noPageOverflow, setTheme } from './assign-helpers.js';
import { clearInbox, seedConversation } from './inbox-fixtures.js';

test('three columns from 1440px, a details overlay below it, and the no-channel empty state', async ({
  page,
}, testInfo) => {
  await signIn(page);
  const identity = await session(page);
  const workspace = identity.user.workspaceId;
  clearInbox(workspace);
  await page.goto('/#/inbox');
  // With no channel connected, the Admin is sent to Channels (design States artboard).
  const empty = page.locator('.inbox-list-pane .inbox-state');
  await expect(empty).toContainText('Connect a channel to start');
  await expect(empty.getByRole('button', { name: 'Go to Channels' })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('inbox-empty-1280.png') });
  const id = seedConversation(workspace, {
    name: 'Synthetic Wide Client',
    assignee: identity.user.id,
    state: 'open',
    messages: [{ body: 'A long first message about a three-bedroom villa in Arabian Ranches.' }],
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`/#/inbox?conversation=${id}`);
  const panel = page.getByRole('complementary', { name: 'Client details' });
  await expect(panel).toBeVisible();
  for (const theme of ['dark', 'light']) {
    await setTheme(page, theme);
    await page.waitForTimeout(400);
    await noPageOverflow(page);
    await page.screenshot({ path: testInfo.outputPath(`inbox-1440-${theme}.png`) });
  }
  await page.setViewportSize({ width: 1024, height: 800 });
  await expect(panel).toBeHidden();
  await page.getByRole('button', { name: 'Client details' }).click();
  await expect(panel).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('inbox-overlay-1024.png') });
  await page.getByRole('button', { name: 'Back to the conversation' }).click();
  await expect(panel).toBeHidden();
});
