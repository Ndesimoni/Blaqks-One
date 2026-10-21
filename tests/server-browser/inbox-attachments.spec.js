import { test, expect } from './fixtures.js';
import { signInMember } from './assign-helpers.js';
import { clientWith } from '../api/mailbox-send-helpers.mjs';
import { jpegWithGps, pdf } from '../api/media-helpers.mjs';
import { addAddress, connectSendgrid } from '../api/sendgrid-helpers.mjs';
import { sendgridCompany, shots } from './sendgrid-helpers.js';

// Packet F3a: files go out with company email and stay with the message in the thread.
test('a New email carries a photo and a PDF, and the thread shows both', async ({
  page,
}, testInfo) => {
  const company = await sendgridCompany('f3a-ui');
  const { session, domain } = company;
  expect((await connectSendgrid(session, domain)).status).toBe(201);
  expect((await addAddress(session, session.user.id, 'owner', 'Owner')).status).toBe(201);
  await clientWith(session, 'f3a.ui.client@example.test');
  await signInMember(page, company.admin.email);
  await page.goto('/#/inbox');
  await page.getByRole('button', { name: 'New email' }).click();
  const dialog = page.getByRole('dialog', { name: 'New email' });
  await dialog.getByLabel('To').fill('Synthetic Mail Client');
  await dialog
    .getByRole('button', { name: /Synthetic Mail Client/ })
    .first()
    .click();
  await dialog.getByLabel('Subject').fill('Brochure and photos');
  await dialog.getByLabel('Message').fill('Please find the brochure and a photo attached.');
  await dialog.getByLabel('Attach files').setInputFiles([
    { name: 'villa.jpg', mimeType: 'image/jpeg', buffer: jpegWithGps() },
    { name: 'brochure.pdf', mimeType: 'application/pdf', buffer: pdf() },
  ]);
  const chosen = dialog.getByRole('list', { name: 'Files to send' });
  await expect(chosen.getByText('brochure.pdf')).toBeVisible();
  await expect(dialog.getByText('Uploading…')).toHaveCount(0);
  // The open dialog covers the theme switch, so it is checked at both widths only.
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.screenshot({ path: testInfo.outputPath(`f3a-new-email-${width}.png`) });
  }
  await page.setViewportSize({ width: 1280, height: 900 });
  await dialog.getByRole('button', { name: 'Send email' }).click();
  const thread = page.locator('.inbox-thread');
  await expect(thread).toContainText('brochure and a photo attached');
  await expect(thread.getByRole('link', { name: /brochure\.pdf/ })).toBeVisible();
  await expect(thread.locator('.chat-attachments img')).toHaveCount(1);
  await shots(page, testInfo, 'f3a-thread');
  const href = await thread.getByRole('link', { name: /brochure\.pdf/ }).getAttribute('href');
  const served = await page.request.get(href);
  expect(served.status()).toBe(200);
  expect(served.headers()['content-type']).toBe('application/pdf');
});
