import { test, expect } from './fixtures.js';
import { assignTeam, held } from './assign-fixtures.js';
import { memberPage, noPageOverflow, openRecord } from './assign-helpers.js';
import { openPage } from './product-nav.js';

const NAME = 'Synthetic contact Layla';

/** A client with a phone and email, a conversation with them, and a client staff hold. */
async function contactTeam(prefix) {
  const team = await assignTeam(prefix);
  const client = { full_name: NAME, phone: '+971 50 000 0111', email: 'layla@example.test' };
  await held(team, 'Clients', { client_id: 'CL-RC-1', ...client });
  await held(team, 'Interaction log', {
    log_id: 'LG-RC-1',
    client_id: 'CL-RC-1',
    channel: 'Phone',
    conversation_topic: 'Parking question',
    contacted_on_uae_time: '2026-10-30 09:40',
  });
  await held(team, 'Clients', { client_id: 'CL-RC-2', ...client }, team.people.one.id);
  return team;
}

/** The slider's Call link and Message button for the named person, and nothing else. */
async function expectContact(panel, name) {
  const head = panel.locator('.record-panel-head');
  await expect(head.getByRole('link', { name: `Call ${name}` })).toHaveAttribute(
    'href',
    'tel:+971500000111',
  );
  for (const gone of [`WhatsApp ${name}`, `Email ${name}`])
    await expect(head.getByRole('link', { name: gone })).toHaveCount(0);
  return head.getByRole('button', { name: `Message ${name}` });
}

test('a client and a conversation with them offer Call and Message', async ({ browser }) => {
  test.setTimeout(120000);
  const team = await contactTeam('rcontact');
  const { page, context } = await memberPage(browser, team.people.admin.email);
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  try {
    await page.setViewportSize({ width: 1280, height: 860 });
    const panel = await openRecord(page, 'CL-RC-1');
    const message = await expectContact(panel, NAME);
    // No chat yet: Message starts the CRM's own new email; without a mailbox it says so.
    await message.click();
    const writing = page.getByRole('dialog', { name: 'New email', exact: true });
    await expect(writing).toContainText('Connect your Google mailbox before sending email.');
    await page.keyboard.press('Escape');
    await expect(writing).toHaveCount(0);
    await expect(panel).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(panel).toHaveCount(0);

    await openPage(page, 'Interaction log');
    await page.getByRole('button', { name: 'Open record LG-RC-1' }).click();
    const log = page.getByRole('dialog');
    await expectContact(log, NAME);
    await page.setViewportSize({ width: 390, height: 844 });
    await noPageOverflow(page);
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }

  // Staff without the email grant may call; with no chat yet, Message says why it cannot start.
  const staff = await memberPage(browser, team.people.one.email);
  try {
    await staff.page.setViewportSize({ width: 1280, height: 860 });
    const panel = await openRecord(staff.page, 'CL-RC-2');
    const head = panel.locator('.record-panel-head');
    await expect(head.getByRole('link', { name: `Call ${NAME}` })).toBeVisible();
    await head.getByRole('button', { name: `Message ${NAME}` }).click();
    await expect(staff.page.locator('.toast')).toContainText(
      `No conversation with ${NAME} yet, and your account can't send email.`,
    );
    await expect(staff.page.getByRole('dialog', { name: 'New email' })).toHaveCount(0);
  } finally {
    await staff.context.close();
  }
});
