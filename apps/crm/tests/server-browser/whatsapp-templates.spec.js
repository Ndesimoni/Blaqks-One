import { test, expect } from './fixtures.js';
import { add } from '../api/assignment-helpers.mjs';
import { agent, clientWith, setTemplates } from '../api/whatsapp-send-helpers.mjs';
import { phone } from '../api/whatsapp-helpers.mjs';
import { memberPage } from './assign-helpers.js';
import { messageClient, themeShots, whatsappTeam } from './whatsapp-browser.js';

// Packet W1b (docs/whatsapp-design.md §8 and §18): the Admin's template list on Channels,
// Refresh from the Twilio stand-in, and Start message for a member without a number.
test('the Admin reads the templates and refreshes them from Twilio', async ({
  browser,
}, testInfo) => {
  test.setTimeout(180000);
  const company = await whatsappTeam('w1b-templates');
  const { page, context } = await memberPage(browser, company.admin.user.email);
  try {
    await page.goto('/#/channels');
    const card = page.getByRole('article', { name: 'WhatsApp', exact: true });
    await card.getByRole('button', { name: 'Manage', exact: true }).click();
    const templates = page.getByRole('region', { name: 'Message templates' });
    await expect(templates).toContainText('Read from Twilio');
    const reminder = templates.getByRole('listitem').filter({ hasText: 'viewing_reminder' });
    await expect(reminder).toContainText('Approved');
    await expect(reminder).toContainText('Offered to members · 2 values to fill in');
    const pending = templates.getByRole('listitem').filter({ hasText: 'price_update' });
    await expect(pending).toContainText('Waiting for approval');
    await expect(pending).toContainText('Not offered until approved');
    await themeShots(page, testInfo, 'w1b-templates');

    await setTemplates(company.sid, [
      { name: 'site_visit', category: 'UTILITY', status: 'approved', body: 'See you at {{1}}.' },
      { name: 'price_update', category: 'UTILITY', status: 'rejected', body: 'Price {{1}}.' },
    ]);
    await templates.getByRole('button', { name: 'Refresh' }).click();
    await expect(templates.getByText('Templates read from Twilio.')).toBeVisible();
    await expect(templates.getByRole('listitem')).toHaveCount(2);
    await expect(templates.getByRole('listitem').filter({ hasText: 'site_visit' })).toContainText(
      '1 value to fill in',
    );
    await expect(templates.getByRole('listitem').filter({ hasText: 'price_update' })).toContainText(
      'Rejected',
    );
    await expect(templates).not.toContainText('viewing_reminder');
  } finally {
    await context.close();
  }
});

test('Start message explains a missing number, and offers Email and WhatsApp to the Admin', async ({
  browser,
}, testInfo) => {
  test.setTimeout(180000);
  const company = await whatsappTeam('w1b-refusal');
  const plain = await agent(company.admin, `w1b-plain-${Date.now().toString(36)}`);
  const client = await clientWith(plain, phone());
  const member = await memberPage(browser, plain.user.email);
  try {
    const writing = await messageClient(member.page, client);
    await expect(writing.locator('.wa-route')).toContainText('No WhatsApp number yet');
    await expect(writing).toContainText('Your Admin gives you a WhatsApp number on Channels.');
    await expect(writing.getByRole('form', { name: 'Send a WhatsApp template' })).toHaveCount(0);
    await themeShots(member.page, testInfo, 'w1b-no-number');
  } finally {
    await member.context.close();
  }
  // The Admin has both channels for a client with an email address too: Email first, then
  // WhatsApp from their own number.
  const both = await add(company.admin, 'Clients', {
    full_name: 'Synthetic WhatsApp Client with email',
    phone: phone(),
    email: `w1b-both-${Date.now().toString(36)}@example.test`,
  });
  const admin = await memberPage(browser, company.admin.user.email);
  try {
    const writing = await messageClient(admin.page, both, 'New email');
    const tabs = writing.getByRole('tablist', { name: 'Send by' });
    await expect(tabs.getByRole('tab', { name: 'Email' })).toHaveAttribute('aria-selected', 'true');
    await tabs.getByRole('tab', { name: 'WhatsApp' }).click();
    const whatsapp = admin.page.getByRole('dialog', { name: 'New WhatsApp message', exact: true });
    await expect(whatsapp.locator('.wa-route')).toContainText(company.adminNumber.phone);
    await expect(whatsapp).toContainText('Templates need the client’s agreement.');
    // The drawer's title follows the chosen tab, so the tabs are found in it again.
    await whatsapp
      .getByRole('tablist', { name: 'Send by' })
      .getByRole('tab', { name: 'Email' })
      .click();
    await expect(admin.page.getByRole('dialog', { name: 'New email', exact: true })).toBeVisible();
  } finally {
    await admin.context.close();
  }
});
