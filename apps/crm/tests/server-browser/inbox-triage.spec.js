import { test, expect } from './fixtures.js';
import { signIn, session } from './helpers.js';
import { clearInbox, seedConversation } from './inbox-fixtures.js';

let workspace;

test.beforeEach(async ({ page }) => {
  await signIn(page);
  const identity = await session(page);
  workspace = identity.user.workspaceId;
  clearInbox(workspace);
});

const enquiry = (contact) =>
  seedConversation(workspace, {
    contact,
    suggested: true,
    messages: [
      { body: 'Hi, is the 2BR in JVC still available?' },
      { body: 'Budget is 95k a year.' },
    ],
  });

test('Create lead links the conversation with the details a person checked', async ({
  page,
}, testInfo) => {
  const id = enquiry('+971500000511');
  await page.goto(`/#/inbox?conversation=${id}`);
  const review = page.getByRole('region', { name: 'New contact review' });
  await expect(review).toContainText(
    'Suggested because the first message reads like a property enquiry',
  );
  await page.screenshot({ path: testInfo.outputPath('triage-review-1280.png') });
  await review.getByRole('button', { name: 'Create lead' }).click();
  const form = page.getByRole('complementary', { name: 'Create lead' });
  await expect(form.getByLabel('What they are looking for')).toHaveValue(/2BR in JVC/);
  await form.getByLabel('Name', { exact: true }).fill('Synthetic Inbox Lead');
  await page.screenshot({ path: testInfo.outputPath('triage-lead-1280.png') });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: testInfo.outputPath('triage-lead-390.png') });
  await page.setViewportSize({ width: 1280, height: 720 });
  await form.getByRole('button', { name: 'Save lead and link conversation' }).click();
  await expect(review).toHaveCount(0);
  await expect(page.getByRole('complementary', { name: 'Client details' })).toContainText(
    'Synthetic Inbox Lead',
  );
  const records = await (await page.request.get(`/api/crm/workspaces/${workspace}/records`)).json();
  const lead = records.records.Clients.find(
    (entry) => entry.record.full_name === 'Synthetic Inbox Lead',
  );
  expect(lead.record.phone).toBe('+971500000511');
  expect(lead.record.notes).toContain('Budget is 95k a year.');
});

test('Link to an existing client, and Not a lead resolves', async ({ page }, testInfo) => {
  const identity = await session(page);
  const created = await page.request.post(`/api/crm/workspaces/${workspace}/records/Clients`, {
    headers: { Origin: 'http://localhost:5175', 'X-CSRF-Token': identity.csrfToken },
    data: { record: { full_name: 'Synthetic Linked Client', phone: '+971500000777' } },
  });
  expect(created.status()).toBe(201);
  await page.goto(`/#/inbox?conversation=${enquiry('+971500000512')}`);
  // The picker searches the records this session loaded, so load them after the API create.
  await page.reload();
  await page.getByRole('button', { name: 'Link to existing client' }).click();
  const picker = page.getByRole('complementary', { name: 'Link to existing client' });
  await picker.getByLabel('Find a client or contact').fill('Synthetic Linked');
  await page.screenshot({ path: testInfo.outputPath('triage-link-1280.png') });
  await picker.getByRole('button', { name: /Synthetic Linked Client/ }).click();
  await expect(page.getByRole('complementary', { name: 'Client details' })).toContainText(
    'Synthetic Linked Client',
  );
  await expect(page.getByRole('region', { name: 'New contact review' })).toHaveCount(0);
  await page.goto(`/#/inbox?conversation=${enquiry('+971500000513')}`);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: testInfo.outputPath('triage-review-390.png') });
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.getByRole('button', { name: 'Not a lead' }).click();
  await expect(page.getByLabel('Conversation state')).toHaveValue('resolved');
});

test('blocking asks once more and the Admin can unblock', async ({ page }) => {
  await page.goto(`/#/inbox?conversation=${enquiry('+971500000514')}`);
  await page.getByRole('button', { name: 'Block sender' }).click();
  const confirm = page.getByRole('group', { name: 'Confirm blocking' });
  await expect(confirm).toContainText('dropped without anyone seeing them');
  await confirm.getByRole('button', { name: 'Block sender' }).click();
  const notice = page.getByRole('region', { name: 'Blocked sender' });
  await expect(notice).toContainText('This sender is blocked');
  await expect(page.locator('.inbox-composer')).toHaveCount(0);
  await notice.getByRole('button', { name: 'Unblock' }).click();
  await expect(notice).toHaveCount(0);
  await expect(page.getByLabel('Conversation state')).toHaveValue('resolved');
});
