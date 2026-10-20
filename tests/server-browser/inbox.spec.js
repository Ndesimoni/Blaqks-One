import { test, expect } from './fixtures.js';
import { signIn, session } from './helpers.js';
import { noPageOverflow, setTheme } from './assign-helpers.js';
import { clearInbox, connectWhatsapp, seedConversation } from './inbox-fixtures.js';

let ids;
let me;

test.beforeEach(async ({ page }) => {
  await signIn(page);
  const identity = await session(page);
  const workspace = identity.user.workspaceId;
  me = identity.user.id;
  clearInbox(workspace);
  await connectWhatsapp(page, identity, '+971500000466');
  ids = {
    enquiry: seedConversation(workspace, {
      suggested: true,
      messages: [{ body: 'Hi, is the 2BR in JVC still available?' }, { body: 'Budget is 1.2M.' }],
    }),
    client: seedConversation(workspace, {
      channel: 'email',
      contact: 'synthetic.client@example.test',
      name: 'Synthetic Client',
      assignee: identity.user.id,
      state: 'open',
      messages: [
        { body: 'Can the seller do 2.35M?' },
        {
          direction: 'outbound',
          status: 'delivered',
          author: identity.user.id,
          body: 'I will ask today.',
        },
      ],
    }),
  };
});

const row = (page, text) => page.locator('.inbox-row', { hasText: text });

test('the Inbox lists, opens and annotates conversations without claiming to send', async ({
  page,
}) => {
  await page.goto('/#/inbox');
  await expect(page.locator('.page-heading h1')).toHaveText('Inbox');
  await expect(page.getByRole('tab', { name: /Mine/ })).toHaveAttribute('aria-selected', 'true');
  await expect(row(page, 'Synthetic Client')).toBeVisible();
  await expect(row(page, '+971500000417')).toHaveCount(0);
  await page.getByRole('tab', { name: /Unassigned/ }).click();
  await expect(row(page, '+971500000417')).toContainText('New contact · Suggested lead');
  await row(page, '+971500000417').click();
  const thread = page.getByRole('region', { name: 'Conversation', exact: true });
  await expect(thread).toContainText('Hi, is the 2BR in JVC still available?');
  await expect(page.locator('.inbox-head')).toContainText('WhatsApp · +971500000417 · Unassigned');
  await page.getByRole('textbox', { name: 'Internal note' }).fill('Synthetic note for the team');
  await page.getByRole('button', { name: 'Add note' }).click();
  const note = page.locator('.inbox-note', { hasText: 'Synthetic note for the team' });
  await expect(note).toContainText('INTERNAL NOTE · ONLY YOUR TEAM SEES THIS');
  await expect(page.locator('.inbox-bubble', { hasText: 'Synthetic note' })).toHaveCount(0);
  await page.getByRole('tab', { name: 'Reply' }).click();
  await expect(page.locator('.inbox-reply-notice')).toContainText(
    'Replying on WhatsApp from the CRM arrives',
  );
  await page.getByLabel('Assign to').selectOption(me);
  await expect(page.locator('.inbox-head')).toContainText('· You');
  await page.getByRole('tab', { name: /Mine/ }).click();
  await expect(row(page, '+971500000417')).toBeVisible();
});

test('a resolved conversation leaves the working tabs and the email thread shows delivery', async ({
  page,
}) => {
  await page.goto(`/#/inbox?conversation=${ids.client}`);
  const thread = page.getByRole('region', { name: 'Conversation', exact: true });
  await expect(thread).toContainText('I will ask today.');
  await expect(thread).toContainText('Delivered ✓✓');
  await expect(page.locator('.inbox-banner')).toContainText('Email is disconnected');
  await page.getByLabel('Conversation state').selectOption('resolved');
  await expect(row(page, 'Synthetic Client')).toHaveCount(0);
  await page.getByLabel('State', { exact: true }).selectOption('resolved');
  await expect(row(page, 'Synthetic Client')).toBeVisible();
});

test('the Inbox reads well at 390px and 1280px in both themes', async ({ page }, testInfo) => {
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`/#/inbox?conversation=${ids.client}`);
    await expect(page.locator('.inbox-thread')).toContainText('I will ask today.');
    for (const theme of ['dark', 'light']) {
      await setTheme(page, theme);
      // Let the theme's colour transition finish so the screenshot shows final colours.
      await page.waitForTimeout(400);
      await noPageOverflow(page);
      await page.screenshot({ path: testInfo.outputPath(`inbox-thread-${width}-${theme}.png`) });
    }
    if (width === 390) {
      await page.getByRole('button', { name: 'Client details' }).click();
      await expect(page.getByRole('complementary', { name: 'Client details' })).toBeVisible();
      await page.screenshot({ path: testInfo.outputPath('inbox-details-390.png') });
      await page.getByRole('button', { name: 'Back to the conversation' }).click();
      await page.getByRole('button', { name: 'Back to conversations' }).click();
      await expect(row(page, 'Synthetic Client')).toBeVisible();
      await noPageOverflow(page);
      await page.screenshot({ path: testInfo.outputPath('inbox-list-390.png') });
    }
  }
});
