import { test, expect } from './fixtures.js';
import { login, query } from '../api/helpers.mjs';
import { activate, invite } from '../api/team-helpers.mjs';
import { signIn, session } from './helpers.js';
import { noPageOverflow, setTheme, signInMember } from './assign-helpers.js';
import { clearInbox, seedConversation } from './inbox-fixtures.js';

test('the Admin edits the lead rules, and the change is kept', async ({ page }, testInfo) => {
  await signIn(page);
  const identity = await session(page);
  query(`DELETE FROM inbox.crm_inbox_rules WHERE workspace_id='${identity.user.workspaceId}'`);
  await page.goto('/#/inbox-rules');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Inbox rules');
  // The mockup's save bar: nothing to save until something changes.
  await expect(page.getByRole('button', { name: 'Save rules' })).toBeDisabled();
  const words = page.getByRole('list', { name: 'Property words' });
  await expect(words).toContainText('villa');
  await words.getByRole('button', { name: 'Remove villa' }).click();
  await page.getByPlaceholder('Add a word').fill('Duplex');
  await page.getByRole('button', { name: 'Add word' }).click();
  await page.getByPlaceholder('Add a word').fill('دوبلكس');
  await page.getByRole('button', { name: 'Add word' }).click();
  await page.getByLabel('Create the lead straight away').check();
  await page.getByRole('button', { name: 'Save rules' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'saved' })).toContainText(
    'The Inbox rules are saved.',
  );
  await page.reload();
  await expect(words).toContainText('duplex');
  await expect(words).toContainText('دوبلكس');
  await expect(words).not.toContainText('villa');
  await expect(page.getByLabel('Create the lead straight away')).toBeChecked();
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 900 });
    for (const theme of ['dark', 'light']) {
      await setTheme(page, theme);
      await page.waitForTimeout(400);
      await noPageOverflow(page);
      await page.screenshot({
        path: testInfo.outputPath(`rules-${width}-${theme}.png`),
        fullPage: true,
      });
    }
  }
});

test('blocked senders are listed with Unblock', async ({ page }) => {
  await signIn(page);
  const identity = await session(page);
  const workspace = identity.user.workspaceId;
  clearInbox(workspace);
  const id = seedConversation(workspace, {
    contact: '+971500000999',
    name: 'Synthetic Spam Sender',
    messages: [{ body: 'Synthetic prize offer' }],
  });
  const blocked = await page.request.post(
    `/api/crm/workspaces/${workspace}/inbox/conversations/${id}/block`,
    {
      headers: { Origin: 'http://localhost:5175', 'X-CSRF-Token': identity.csrfToken },
      data: { expectedVersion: 1 },
    },
  );
  expect(blocked.status()).toBe(200);
  await page.goto('/#/inbox-rules');
  const card = page.getByRole('region', { name: 'Blocked senders', exact: true });
  await expect(card).toContainText('Synthetic Spam Sender');
  await expect(card).toContainText('WhatsApp');
  await card.getByRole('button', { name: 'Unblock Synthetic Spam Sender' }).click();
  await expect(card).toContainText('No blocked senders.');
  clearInbox(workspace);
});

test('staff never see or open the Inbox rules', async ({ page }) => {
  const admin = await login('admin-a');
  const invited = await invite(admin, 'inbox-rules-staff');
  await activate(invited);
  await signInMember(page, invited.email);
  await expect(page.getByRole('button', { name: 'Inbox rules' })).toHaveCount(0);
  await page.goto('/#/inbox-rules');
  await expect(page.getByRole('heading', { name: /^You don't have access to / })).toBeVisible();
});
