import { test, expect } from './fixtures.js';
import { memberPage, signInMember } from './assign-helpers.js';
import { clientWith } from '../api/mailbox-send-helpers.mjs';
import { addAddress, connectSendgrid } from '../api/sendgrid-helpers.mjs';
import { sendgridCompany } from './sendgrid-helpers.js';

// E3d: a SendGrid company emails from each member's own address; Google is never asked for.
test('the Inbox sends from the company address and never asks for Google', async ({
  page,
  browser,
}) => {
  const company = await sendgridCompany('e3d-inbox');
  const { session, domain } = company;
  expect((await connectSendgrid(session, domain)).status).toBe(201);
  expect((await addAddress(session, session.user.id, 'owner', 'Owner')).status).toBe(201);
  await clientWith(session, 'sendgrid.inbox.client@example.test');
  await signInMember(page, company.admin.email);
  await page.goto('/#/inbox');
  await page.getByRole('button', { name: 'New email' }).click();
  const dialog = page.getByRole('dialog', { name: 'New email' });
  await expect(dialog).toContainText(`Sent from owner@${domain}`);
  await expect(dialog).not.toContainText('Google');
  await dialog.getByLabel('To').fill('Synthetic Mail Client');
  await dialog
    .getByRole('button', { name: /Synthetic Mail Client/ })
    .first()
    .click();
  await dialog.getByLabel('Subject').fill('Your viewing in Dubai Marina');
  await dialog.getByLabel('Message').fill('Hello, the viewing is confirmed for Saturday.');
  await dialog.getByRole('button', { name: 'Send email' }).click();
  await expect(page.locator('.inbox-thread')).toContainText('the viewing is confirmed');
  await expect(page.locator('.inbox-thread')).not.toContainText('Connect your Google mailbox');
  // A member without an address is told to ask the Admin, with no Google step.
  const { page: agentPage } = await memberPage(browser, company.agent.email);
  await agentPage.goto('/#/inbox');
  await agentPage.getByRole('button', { name: 'New email' }).click();
  const empty = agentPage.getByRole('dialog', { name: 'New email' });
  await expect(empty).toContainText('Ask your Admin for a sending address');
  await expect(empty.getByRole('button', { name: 'Open My mailbox' })).toHaveCount(0);
});
