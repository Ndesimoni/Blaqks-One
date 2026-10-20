import { test, expect } from './fixtures.js';
import { login } from '../api/helpers.mjs';
import { activate, invite } from '../api/team-helpers.mjs';
import { signIn } from './helpers.js';
import { memberPage, noPageOverflow, setTheme } from './assign-helpers.js';

const shots = async (page, testInfo, name) => {
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 860 });
    for (const theme of ['light', 'dark']) {
      await setTheme(page, theme);
      await page.waitForTimeout(300);
      await noPageOverflow(page);
      await page.screenshot({ path: testInfo.outputPath(`${name}-${width}-${theme}.png`) });
    }
  }
  await page.setViewportSize({ width: 1280, height: 860 });
};

test('a team talks in #general and privately', async ({ page, browser }, testInfo) => {
  const admin = await login('admin-a');
  const invited = await invite(admin, `chat-browser-${Date.now()}`);
  const colleague = await activate(invited);
  await signIn(page);
  await page.goto('/#/team-chat');
  await page.getByRole('button', { name: /#general/ }).click();
  const thread = page.locator('.chat-thread');
  const composer = page.getByLabel('Message', { exact: true });
  await composer.fill('Good morning team, viewing schedule is in the shared calendar.');
  await composer.press('Enter');
  await expect(thread).toContainText('viewing schedule is in the shared calendar');
  await page.getByRole('button', { name: 'New channel' }).click();
  await page.getByLabel('Channel name').fill('Listings');
  await page.getByRole('button', { name: 'Create channel' }).click();
  await expect(page.getByRole('heading', { name: '#listings' })).toBeVisible();
  // The colleague sees the channel message and writes privately to the Admin.
  const other = await memberPage(browser, invited.email);
  await other.page.goto('/#/team-chat');
  await other.page.getByRole('button', { name: /#general/ }).click();
  await expect(other.page.locator('.chat-thread')).toContainText('Good morning team');
  await other.page.getByRole('button', { name: 'New message' }).click();
  await other.page.getByLabel('Find a colleague').fill('Fixture Admin');
  await other.page.getByRole('button', { name: /Fixture Admin A/ }).click();
  await expect(other.page.getByText('Private: only the two of you')).toBeVisible();
  const private_ = other.page.getByLabel('Message', { exact: true });
  await private_.fill('Can you cover my 5pm viewing in JVC?');
  await private_.press('Enter');
  await other.context.close();
  // The Admin sees the unread private message and answers it.
  await page.goto('/#/team-chat');
  const direct = page.getByRole('button', { name: new RegExp(colleague.user.name) });
  await expect(direct.locator('.chat-badge')).toHaveText('1');
  await direct.click();
  await expect(page.locator('.chat-thread')).toContainText('cover my 5pm viewing');
  await shots(page, testInfo, 'chat-direct');
  await page.getByRole('button', { name: /#general/ }).click();
  await shots(page, testInfo, 'chat-general');
});
