import { test, expect } from './fixtures.js';
import { login } from '../api/helpers.mjs';
import { activate, invite } from '../api/team-helpers.mjs';
import { signIn } from './helpers.js';
import { memberPage, noPageOverflow, setTheme } from './assign-helpers.js';

/** Both widths and themes, with no sideways scrolling (packet C3). */
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

test('a group is started, a colleague is mentioned and sees the mention', async ({
  page,
  browser,
}, testInfo) => {
  const admin = await login('admin-a');
  const stamp = Date.now();
  const invitedA = await invite(admin, `c3-browser-a-${stamp}`);
  const invitedB = await invite(admin, `c3-browser-b-${stamp}`);
  const [first, second] = [await activate(invitedA), await activate(invitedB)];
  await signIn(page);
  await page.goto('/#/team-chat');
  await page.getByRole('button', { name: 'New group' }).click();
  await page.getByLabel('Group name (optional)').fill('Marina viewings');
  await page.getByLabel('Find a colleague').fill(`${stamp}`);
  await expect(page.getByRole('button', { name: 'Create group' })).toBeDisabled();
  await page.getByRole('checkbox', { name: first.user.name }).check();
  await page.getByRole('checkbox', { name: second.user.name }).check();
  await expect(page.getByText('2 colleagues chosen')).toBeVisible();
  await shots(page, testInfo, 'chat-new-group');
  await page.getByRole('button', { name: 'Create group' }).click();
  await expect(page.getByRole('heading', { name: 'Marina viewings' })).toBeVisible();
  await expect(page.getByText('only its 3 members can read it')).toBeVisible();
  // Typing @ suggests the group's members; a click chooses one.
  const composer = page.getByLabel('Message', { exact: true });
  const options = page.getByRole('listbox', { name: 'Colleagues to mention' });
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 860 });
    await composer.fill('Please call @Synth');
    await expect(options.getByRole('option')).toHaveCount(2);
    await noPageOverflow(page);
    await page.screenshot({ path: testInfo.outputPath(`chat-mention-list-${width}.png`) });
  }
  await page.setViewportSize({ width: 1280, height: 860 });
  await composer.fill(`Please call @Synthetic c3-browser-a`);
  await options.getByRole('option', { name: first.user.name }).click();
  await expect(composer).toHaveValue(`Please call @${first.user.name} `);
  await composer.press('End');
  await composer.pressSequentially('about the seller');
  await composer.press('Enter');
  const thread = page.locator('.chat-thread');
  await expect(thread.locator('.chat-mention')).toHaveText(`@${first.user.name}`);
  // Keyboard: Enter chooses the suggestion instead of sending.
  await composer.fill('Thanks @Synthetic c3-browser-b');
  await composer.press('Enter');
  await expect(composer).toHaveValue(`Thanks @${second.user.name} `);
  await expect(options).toHaveCount(0);
  await composer.press('Enter');
  await expect(thread.locator('.chat-mention')).toHaveCount(2);
  await expect(composer).toHaveValue('');
  // The mentioned colleague sees @1 on the sidebar and on the group, then reads it.
  const other = await memberPage(browser, invitedA.email);
  const nav = other.page.getByRole('navigation', { name: 'CRM sections', exact: true });
  const chatNav = nav.getByRole('button', { name: /^Team chat/ });
  await expect(chatNav).toHaveAccessibleName(/1 mention of you/);
  await expect(chatNav.locator('.connected-nav-badge')).toHaveText('@1');
  await chatNav.click();
  const row = other.page.getByRole('button', { name: /Marina viewings/ });
  await expect(row.locator('.chat-mention-badge')).toContainText('@1');
  await row.click();
  const mine = other.page.locator('.chat-message.is-mentioned');
  await expect(mine).toHaveCount(1);
  await expect(mine).toContainText('Mentions you');
  await expect(mine.locator('.chat-mention.is-me')).toHaveText(`@${first.user.name}`);
  await expect(row.locator('.chat-mention-badge')).toHaveCount(0);
  await shots(other.page, testInfo, 'chat-mentioned');
  await Promise.all([
    other.page.waitForResponse((reply) => reply.url().endsWith('/chat/summary')),
    other.page.reload(),
  ]);
  await expect(chatNav).not.toHaveAccessibleName(/mention/);
  // A member may leave the group; it disappears from their list.
  await other.page.getByRole('button', { name: 'Leave group' }).click();
  await other.page
    .getByRole('group', { name: 'Group actions' })
    .getByRole('button', {
      name: 'Leave group',
    })
    .click();
  await expect(other.page.getByRole('button', { name: /Marina viewings/ })).toHaveCount(0);
  await other.context.close();
});
