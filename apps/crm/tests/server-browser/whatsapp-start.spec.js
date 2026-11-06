import { test, expect } from './fixtures.js';
import { callback, clientWith, RESERVED, sentTo } from '../api/whatsapp-send-helpers.mjs';
import { memberPage } from './assign-helpers.js';
import {
  latestWhatsapp,
  messageClient,
  recordAgreement,
  themeShots,
  whatsappTeam,
} from './whatsapp-browser.js';

// Packet W1b (docs/whatsapp-design.md §5 and §18): Start message on WhatsApp from a client's
// record, with the client's agreement and an approved template, then its statuses. The
// quiet stand-in number accepts the message without callbacks, so the test signs them.
test('a member starts on WhatsApp with agreement and a template, then sees Sent, Delivered and Read', async ({
  browser,
}, testInfo) => {
  test.setTimeout(240000);
  const company = await whatsappTeam('w1b-start');
  const client = await clientWith(company.agent, RESERVED.quiet);
  const { page, context } = await memberPage(browser, company.agent.user.email);
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  try {
    await page.setViewportSize({ width: 1280, height: 900 });
    // The agent has WhatsApp but not email, so Message opens WhatsApp alone, without tabs.
    const writing = await messageClient(page, client);
    await expect(writing.getByRole('tablist')).toHaveCount(0);
    const route = writing.locator('.wa-route');
    await expect(route).toContainText(company.agentNumber.phone);
    await expect(route).toContainText(client.record.full_name);
    await expect(route).toContainText(RESERVED.quiet);
    await expect(writing.locator('.wa-consent')).toContainText('No agreement yet');
    await expect(writing).toContainText('Templates need the client’s agreement.');
    await recordAgreement(writing);
    await expect(writing.locator('.wa-consent')).toContainText('Agreed · by phone');

    const form = writing.getByRole('form', { name: 'Send a WhatsApp template' });
    await form.getByLabel('Template').selectOption({ label: 'viewing_reminder' });
    const preview = form.locator('.wa-preview');
    await expect(preview).toContainText(
      'Hello {{1}}, this is a reminder of your viewing on {{2}}.',
    );
    await form.getByLabel('Value 1').fill('Sara');
    await form.getByLabel('Value 2').fill('Saturday    at 5 pm');
    await form.getByRole('button', { name: 'Send template' }).click();
    await expect(form.getByLabel('Value 2')).toBeFocused();
    await expect(form.getByLabel('Value 2')).toHaveAttribute('aria-invalid', 'true');
    await expect(form).toContainText('Keep this value on one line, without tabs or four spaces');
    await form.getByLabel('Value 2').fill('Saturday at 5 pm');
    await expect(preview).toContainText(
      'Hello Sara, this is a reminder of your viewing on Saturday at 5 pm.',
    );
    await themeShots(page, testInfo, 'w1b-start-template');
    await form.getByRole('button', { name: 'Send template' }).click();
    await expect(writing).toHaveCount(0);

    // The new conversation opens in the messenger with the filled-in template.
    const messenger = page.getByRole('dialog', { name: 'Client inbox', exact: true });
    const thread = messenger.locator('.inbox-thread');
    const text = 'Hello Sara, this is a reminder of your viewing on Saturday at 5 pm.';
    await expect(thread).toContainText(text);
    const bubble = thread.locator('.inbox-message', { hasText: text });
    await expect(bubble).toContainText('Template · viewing_reminder');
    const meta = bubble.locator('.inbox-message-meta');
    await expect(meta).toContainText('Sent ✓', { timeout: 30000 });

    const { message } = latestWhatsapp(company.agent.user.workspaceId);
    const sent = (await sentTo(RESERVED.quiet)).find((item) =>
      item.statusCallback?.endsWith(message),
    );
    const signed = (status) =>
      callback(company, sent.statusCallback, {
        AccountSid: company.sid,
        MessageSid: sent.sid,
        MessageStatus: status,
        From: sent.from,
        To: sent.to,
      });
    expect(await signed('delivered')).toBe(200);
    await expect(meta).toContainText('Delivered ✓✓', { timeout: 30000 });
    expect(await signed('read')).toBe(200);
    await expect(meta).toContainText('Read ✓✓', { timeout: 30000 });
    // The conversation's composer: window closed, agreement in force, templates offered.
    const composer = messenger.locator('.inbox-composer');
    await expect(composer).toContainText('The 24-hour window is closed: send an approved template');
    await expect(composer.locator('.wa-consent')).toContainText('Agreed · by phone');
    await expect(composer.getByRole('form', { name: 'Send a WhatsApp template' })).toBeVisible();
    await themeShots(page, testInfo, 'w1b-thread-read');
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
});
