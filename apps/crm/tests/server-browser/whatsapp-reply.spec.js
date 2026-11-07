import { test, expect } from './fixtures.js';
import { query } from '../api/helpers.mjs';
import { clientWith, RESERVED } from '../api/whatsapp-send-helpers.mjs';
import { memberPage, noPageOverflow } from './assign-helpers.js';
import {
  latestWhatsapp,
  messageClient,
  recordAgreement,
  themeShots,
  whatsappTeam,
} from './whatsapp-browser.js';

// Packet W1b (docs/whatsapp-design.md §5, §10, §11 and §18): a failed send's plain reason,
// free text inside the 24-hour window, STOP, and the Admin on a colleague's number restoring
// agreement with a reason. The stand-in reports its "not on WhatsApp" number undelivered.
test('a failed send says why, the open window allows text, and STOP holds until the Admin restores', async ({
  browser,
}, testInfo) => {
  test.setTimeout(240000);
  const company = await whatsappTeam('w1b-reply');
  const client = await clientWith(company.agent, RESERVED.notOnWhatsapp);
  const agent = await memberPage(browser, company.agent.user.email);
  const { page } = agent;
  try {
    const writing = await messageClient(page, client);
    await recordAgreement(writing, 'In person');
    await expect(writing.locator('.wa-consent')).toContainText('Agreed · in person');
    const form = writing.getByRole('form', { name: 'Send a WhatsApp template' });
    await form.getByLabel('Template').selectOption({ label: 'new_listing' });
    await expect(form.getByLabel('Value 1')).toHaveCount(0);
    await form.getByRole('button', { name: 'Send template' }).click();
    await expect(writing).toHaveCount(0);

    // The full Inbox page shows the failure, its reason and Send again.
    const { conversation } = latestWhatsapp(company.agent.user.workspaceId);
    await page.goto(`/#/inbox?conversation=${conversation}`);
    const thread = page.locator('#main-content .inbox-thread');
    const bubble = thread.locator('.inbox-message', { hasText: 'A new listing matches' });
    await expect(bubble).toContainText('Not delivered', { timeout: 30000 });
    await expect(bubble).toContainText('This number cannot receive WhatsApp messages');
    await expect(bubble.getByRole('button', { name: 'Send again' })).toBeVisible();

    // A client message an hour ago opens the window: free text, no attachments.
    query(`UPDATE inbox.crm_inbox_conversations SET last_inbound_at=now()-interval '1 hour'
      WHERE id='${conversation}'`);
    await page.reload();
    const composer = page.locator('#main-content .inbox-composer');
    await expect(composer).toContainText('Window open until');
    const attach = composer.getByRole('button', { name: 'Attach files' });
    await expect(attach).toHaveAttribute('aria-disabled', 'true');
    await expect(attach).toHaveAttribute('title', 'Attachments are not available on WhatsApp yet.');
    await composer.getByRole('button', { name: 'Use a template' }).click();
    await expect(composer.getByRole('form', { name: 'Send a WhatsApp template' })).toBeVisible();
    await composer.getByRole('button', { name: 'Write a message' }).click();
    await composer.getByRole('textbox', { name: 'Your reply' }).fill('Is Saturday at 5 fine?');
    await themeShots(page, testInfo, 'w1b-window-open');
    await noPageOverflow(page);
    await composer.getByRole('button', { name: 'Send', exact: true }).click();
    await expect(thread).toContainText('Is Saturday at 5 fine?');

    // STOP, recorded for the client after a confirmation, stops every send.
    await composer.getByRole('button', { name: 'Agreement' }).click();
    const panel = composer.getByRole('form', { name: 'Client’s agreement to WhatsApp messages' });
    await panel.getByRole('button', { name: 'Record STOP' }).click();
    const confirm = panel.getByRole('group', { name: 'Record STOP' });
    await expect(confirm).toContainText('Record that the client asked to stop?');
    await expect(confirm.getByRole('button', { name: 'Cancel' })).toBeFocused();
    await confirm.getByRole('button', { name: 'Record STOP' }).click();
    await expect(composer.locator('.wa-chip.wa-consent')).toContainText(
      'Client asked to stop · recorded by the team',
    );
    await expect(composer).toContainText('The client asked to stop messages');
  } finally {
    await agent.context.close();
  }

  // The Admin reads the agent's conversation: it is on the agent's number, and only the
  // Admin restores agreement after a STOP, with a written reason.
  const admin = await memberPage(browser, company.admin.user.email);
  try {
    const { conversation } = latestWhatsapp(company.agent.user.workspaceId);
    await admin.page.goto(`/#/inbox?conversation=${conversation}`);
    const composer = admin.page.locator('#main-content .inbox-composer');
    await composer.getByRole('tab', { name: 'Reply' }).click();
    await expect(composer).toContainText(`Sent from ${company.agent.user.name}’s number.`);
    await composer.getByRole('button', { name: 'Agreement' }).click();
    const panel = composer.getByRole('form', { name: 'Client’s agreement to WhatsApp messages' });
    await panel.getByRole('button', { name: 'Restore agreement' }).click();
    await expect(panel).toContainText('Write the reason for restoring agreement.');
    await expect(panel.getByLabel('Why restore agreement?')).toBeFocused();
    await panel.getByLabel('Why restore agreement?').fill('Client asked again by phone today.');
    await themeShots(admin.page, testInfo, 'w1b-restore');
    await panel.getByRole('button', { name: 'Restore agreement' }).click();
    await expect(composer.locator('.wa-chip.wa-consent')).toContainText(
      'Agreed · restored by the Admin',
    );
  } finally {
    await admin.context.close();
  }
});
