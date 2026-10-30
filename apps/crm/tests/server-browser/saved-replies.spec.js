import { test, expect } from './fixtures.js';
import { noPageOverflow, signInMember } from './assign-helpers.js';
import { clientWith } from '../api/mailbox-send-helpers.mjs';
import { addAddress, connectSendgrid } from '../api/sendgrid-helpers.mjs';
import { sendgridCompany } from './sendgrid-helpers.js';

// Packet N2 (docs/saved-replies-drafts.md): saved replies with fill-ins, and a private draft
// that comes back after a reload and is emptied by sending.
test('a company saved reply fills in, the draft comes back, and sending clears it', async ({
  page,
}, testInfo) => {
  const company = await sendgridCompany('n2-ui');
  const { session, domain } = company;
  expect((await connectSendgrid(session, domain)).status).toBe(201);
  expect((await addAddress(session, session.user.id, 'owner', 'Owner')).status).toBe(201);
  await clientWith(session, 'n2.ui.client@example.test');
  await signInMember(page, company.admin.email);
  await page.goto('/#/inbox');
  await page.getByRole('button', { name: 'New email' }).click();
  const start = page.getByRole('dialog', { name: 'New email' });
  await start.getByLabel('To').fill('Synthetic Mail Client');
  await start
    .getByRole('button', { name: /Synthetic Mail Client/ })
    .first()
    .click();
  await start.getByLabel('Subject').fill('Your viewing');
  await start.getByLabel('Message').fill('Hello, here are the details.');
  await start.getByRole('button', { name: 'Send email' }).click();
  const thread = page.locator('.inbox-thread');
  await expect(thread).toContainText('here are the details');
  // No saved replies yet: one is added from the picker, after the form asks for a title.
  const open = page.getByRole('button', { name: 'Saved replies' });
  const picker = page.getByRole('dialog', { name: 'Saved replies' });
  await open.click();
  await expect(picker).toContainText('No saved replies yet');
  await picker.getByRole('button', { name: 'Add a saved reply' }).click();
  const form = page.getByRole('dialog', { name: 'Add a saved reply' });
  await form.getByRole('button', { name: 'Save reply' }).click();
  await expect(form.getByText('Enter a title.')).toBeVisible();
  await expect(form.getByLabel('Title')).toBeFocused();
  await form.getByLabel('Title').fill('Viewing confirmed');
  await form.getByLabel('Text').fill('Hi , your viewing with {my name} is confirmed.');
  await form.getByLabel('Text').evaluate((area) => area.setSelectionRange(3, 3));
  await form.getByRole('button', { name: 'Insert {client name}' }).click();
  await expect(form.getByLabel('Text')).toHaveValue(
    'Hi {client name}, your viewing with {my name} is confirmed.',
  );
  await form.getByRole('button', { name: 'Save reply' }).click();
  const manager = page.getByRole('dialog', { name: 'Saved replies' });
  await expect(manager.getByText('Viewing confirmed')).toBeVisible();
  await expect(thread).not.toContainText('Hi {client name}', 'saving never sends the reply');
  await manager.getByRole('button', { name: 'Close' }).click();
  // Enter in the search never sends; the arrow keys and Enter choose a reply.
  const box = page.getByLabel('Your reply');
  await box.fill('Hello');
  await open.click();
  const search = picker.getByRole('combobox', { name: 'Search saved replies' });
  await expect(search).toBeFocused();
  await search.fill('nothing like this');
  await search.press('Enter');
  await expect(picker).toContainText('No saved replies match');
  await picker.getByRole('button', { name: 'Clear search' }).click();
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await noPageOverflow(page);
    await page.screenshot({ path: testInfo.outputPath(`n2-picker-${width}.png`) });
  }
  await page.setViewportSize({ width: 1280, height: 900 });
  await search.focus();
  await search.press('ArrowDown');
  await search.press('Enter');
  await expect(picker).toBeHidden();
  const filled = new RegExp(
    `^Hello\\nHi Synthetic Mail Client \\d+, your viewing with ${company.admin.name} is confirmed\\.$`,
  );
  await expect(box).toHaveValue(filled);
  await expect(box).toBeFocused();
  await expect(thread).not.toContainText('your viewing with');
  // The draft is saved, comes back after a reload, and is emptied by sending.
  await expect(page.getByText('Draft saved')).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('Your reply')).toHaveValue(filled);
  await page.getByRole('button', { name: 'Send', exact: true }).click();
  await expect(thread).toContainText('your viewing with');
  await expect(page.getByLabel('Your reply')).toHaveValue('');
  await page.reload();
  await expect(thread).toContainText('your viewing with');
  await expect(page.getByLabel('Your reply')).toHaveValue('');
});
