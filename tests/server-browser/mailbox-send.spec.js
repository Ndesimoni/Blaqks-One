import { test, expect } from './fixtures.js';
import { query } from '../api/helpers.mjs';
import { signIn, session } from './helpers.js';
import { setTheme } from './assign-helpers.js';
import { clearInbox } from './inbox-fixtures.js';

/** Both widths in the current theme, for a modal that covers the theme switch. */
const widths = async (page, testInfo, name) => {
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 860 });
    await page.waitForTimeout(300);
    await page.screenshot({ path: testInfo.outputPath(`${name}-${width}.png`) });
  }
  await page.setViewportSize({ width: 1280, height: 860 });
};

const shots = async (page, testInfo, name) => {
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 860 });
    for (const theme of ['light', 'dark']) {
      await setTheme(page, theme);
      await page.waitForTimeout(300);
      await page.screenshot({ path: testInfo.outputPath(`${name}-${width}-${theme}.png`) });
    }
  }
  await page.setViewportSize({ width: 1280, height: 860 });
};

test('connect a Google mailbox, start an email and see it sent', async ({ page }, testInfo) => {
  await signIn(page);
  const identity = await session(page);
  const workspace = identity.user.workspaceId;
  clearInbox(workspace);
  query(
    `UPDATE integrations.crm_channel_connections SET state='disconnected',credential_sealed=NULL,
     credential_key_version=NULL,credential_updated_at=NULL WHERE workspace_id='${workspace}'
     AND owner_member_id='${identity.user.id}' AND channel='email'`,
  );
  const created = await page.request.post(`/api/crm/workspaces/${workspace}/records/Clients`, {
    headers: { Origin: 'http://localhost:5175', 'X-CSRF-Token': identity.csrfToken },
    data: { record: { full_name: 'Synthetic Email Client', email: 'mail.client@example.test' } },
  });
  expect(created.status()).toBe(201);
  await page.goto('/#/my-mailbox');
  await expect(page.getByRole('heading', { level: 1, name: 'My mailbox' })).toBeVisible();
  await shots(page, testInfo, 'mailbox-empty');
  await page.getByRole('button', { name: 'Connect Google mailbox' }).click();
  await expect(page.getByRole('heading', { name: 'Pretend Google sign-in' })).toBeVisible();
  await page.getByLabel('Mailbox address').fill('aidah@keys-fixture.test');
  await page.getByRole('button', { name: 'Allow the CRM to send and read email' }).click();
  await expect(page.getByText('Your mailbox is connected.')).toBeVisible();
  expect(page.url()).not.toContain('code=');
  await page.getByRole('button', { name: 'Open My mailbox' }).click();
  await expect(page.getByText('aidah@keys-fixture.test')).toBeVisible();
  await expect(page.locator('.mailbox-card .badge')).toHaveText('Connected');
  await shots(page, testInfo, 'mailbox-connected');
  await page.goto('/#/inbox');
  await page.reload();
  await shots(page, testInfo, 'inbox-list');
  await page.getByRole('button', { name: 'New email' }).click();
  const dialog = page.getByRole('dialog', { name: 'New email' });
  await dialog.getByLabel('To').fill('Synthetic Email');
  await dialog.getByRole('button', { name: /Synthetic Email Client/ }).click();
  await dialog.getByLabel('Subject').fill('Your viewing in Dubai Marina');
  await dialog.getByLabel('Message').fill('Hello, the viewing is confirmed for Saturday at 5.');
  await widths(page, testInfo, 'start-email');
  await dialog.getByRole('button', { name: 'Send email' }).click();
  await expect(dialog).toHaveCount(0);
  const thread = page.locator('.inbox-thread');
  await expect(thread).toContainText('the viewing is confirmed');
  await expect(thread.locator('.inbox-message-meta').last()).toContainText('Sent', {
    timeout: 20000,
  });
  const composer = page.locator('.inbox-composer');
  await composer.getByLabel('Your reply').fill('Following up on Saturday.');
  await shots(page, testInfo, 'reply');
  await composer.getByRole('button', { name: 'Send', exact: true }).click();
  await expect(thread).toContainText('Following up on Saturday.');
});
