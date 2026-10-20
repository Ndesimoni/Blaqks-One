import { test, expect } from './fixtures.js';
import { login } from '../api/helpers.mjs';
import { activate, invite } from '../api/team-helpers.mjs';
import { signIn, session } from './helpers.js';
import { noPageOverflow, signInMember } from './assign-helpers.js';
import { clearInbox, seedConversation } from './inbox-fixtures.js';

test('arrow keys move through the list and Enter opens a conversation', async ({ page }) => {
  await signIn(page);
  const identity = await session(page);
  const workspace = identity.user.workspaceId;
  clearInbox(workspace);
  for (const name of ['First Synthetic Sender', 'Second Synthetic Sender']) {
    seedConversation(workspace, {
      name,
      state: 'open',
      messages: [{ body: `Hello from ${name}` }],
    });
  }
  await page.goto('/#/inbox');
  await page.getByRole('tab', { name: /Team/ }).click();
  const rows = page.locator('.inbox-row');
  await expect(rows).toHaveCount(2);
  await rows.first().focus();
  await page.keyboard.press('ArrowDown');
  await expect(rows.nth(1)).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('.inbox-thread')).toContainText('Hello from');
  await expect(rows.nth(1)).toHaveAttribute('aria-current', 'true');
});

test('a staff member reads their Inbox in Arabic, right to left', async ({ page }, testInfo) => {
  const admin = await login('admin-a');
  const invited = await invite(admin, 'inbox-arabic');
  const staff = await activate(invited);
  clearInbox(admin.user.workspaceId);
  seedConversation(admin.user.workspaceId, {
    channel: 'whatsapp',
    name: 'Synthetic Arabic Client',
    assignee: staff.user.id,
    state: 'open',
    messages: [{ body: 'مرحبا، هل الشقة متاحة؟' }],
  });
  await signInMember(page, invited.email);
  await page.goto('/#/my-profile');
  await page.getByRole('radio', { name: /العربية/ }).check();
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  // Staff without any reply permission still reach the Inbox from the sidebar.
  await page
    .getByRole('button', { name: /^صندوق الوارد، |^صندوق الوارد, |^صندوق الوارد$/ })
    .click();
  await expect(page.getByRole('tab', { name: /محادثاتي/ })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await page.locator('.inbox-row', { hasText: 'Synthetic Arabic Client' }).click();
  await expect(page.locator('.inbox-thread')).toContainText('مرحبا، هل الشقة متاحة؟');
  await expect(page.locator('.inbox-reply-notice')).toHaveCount(0);
  // Assigned-only staff may only claim or release, as the server allows.
  await expect(page.getByLabel('إسناد إلى')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'تخلَّ عنها' })).toBeVisible();
  await page.getByRole('tab', { name: 'رد' }).click();
  await expect(page.locator('.inbox-reply-notice')).toContainText('واتساب غير مرتبط');
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await noPageOverflow(page);
    await page.screenshot({ path: testInfo.outputPath(`inbox-arabic-${width}.png`) });
  }
});
