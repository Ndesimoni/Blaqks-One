import { test, expect } from './fixtures.js';
import { query } from '../api/helpers.mjs';
import { openRecord } from './assign-helpers.js';
import { session, signIn } from './helpers.js';
import { clearInbox } from './inbox-fixtures.js';

const NAME = 'Synthetic Slider Email Client';

test("a client's Message writes in Messages, then reopens that conversation", async ({ page }) => {
  test.setTimeout(120000);
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
    data: { record: { full_name: NAME, email: 'slider.client@example.test' } },
  });
  expect(created.status()).toBe(201);
  const clientId = (await created.json()).record.client_id;
  await page.goto('/#/my-mailbox');
  await page.getByRole('button', { name: 'Connect Google mailbox' }).click();
  await page.getByLabel('Mailbox address').fill('slider@keys-fixture.test');
  await page.getByRole('button', { name: 'Allow the CRM to send and read email' }).click();
  await expect(page.getByText('Your mailbox is connected.')).toBeVisible();

  await page.goto('/#/clients');
  await page.reload();
  const panel = await openRecord(page, clientId);
  const message = panel.getByRole('button', { name: `Message ${NAME}` });
  // No conversation yet: Message starts the Messages "New email" with the client chosen.
  await message.click();
  const writing = page.getByRole('dialog', { name: 'New email', exact: true });
  await expect(writing).toContainText('slider.client@example.test');
  await expect(writing.getByLabel('Subject')).toBeFocused();
  await writing.getByLabel('Subject').fill('Your viewing on Saturday');
  await writing.getByLabel('Message').fill('Hello, Saturday at 5 is confirmed.');
  await writing.getByRole('button', { name: 'Send email' }).click();
  await expect(writing).toHaveCount(0);
  // The new conversation opens in the messenger, over the client's slider.
  const messenger = page.getByRole('dialog', { name: 'Client inbox', exact: true });
  await expect(messenger.locator('.inbox-thread')).toContainText('Saturday at 5 is confirmed');
  await page.keyboard.press('Escape');
  await expect(messenger).toHaveCount(0);
  await expect(panel).toBeVisible();

  // The next Message opens that conversation instead of a new email.
  await message.click();
  await expect(messenger.locator('.inbox-thread')).toContainText('Saturday at 5 is confirmed');
  await expect(page.getByRole('dialog', { name: 'New email', exact: true })).toHaveCount(0);
});
