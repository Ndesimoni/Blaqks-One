import { randomUUID } from 'node:crypto';
import { test, expect } from './fixtures.js';
import { signIn } from './helpers.js';
import { setTheme, signInMember } from './assign-helpers.js';
import { query } from '../api/helpers.mjs';
import { clientWith, startMessage } from '../api/mailbox-send-helpers.mjs';
import { pdf } from '../api/media-helpers.mjs';
import { addAddress, connectSendgrid } from '../api/sendgrid-helpers.mjs';
import { sendgridCompany } from './sendgrid-helpers.js';

// Owner feedback 2026-10-22: the conversation fills the window like a messenger app and the
// messages get most of it: at least 60% of a laptop window and 55% of a phone screen.
const SIZES = [
  { width: 1280, height: 800, share: 0.6 },
  { width: 1440, height: 900, share: 0.6 },
  { width: 390, height: 844, share: 0.55 },
];

const TALK = [
  ['inbound', 'Thank you! Could we move it to 6 pm? I finish work late on Saturdays.'],
  ['outbound', 'Of course, 6 pm works. I will meet you in the lobby of Marina Gate 2.'],
  ['inbound', 'Perfect. Is there visitor parking?'],
  ['outbound', 'Yes, visitor parking is on level B1. Please bring your Emirates ID for security.'],
  [
    'inbound',
    'Great, see you then. Is the service charge included in the asking price, or is it ' +
      "separate? And does the apartment have a maid's room?",
  ],
  ['outbound', "The service charge is separate. Yes, there is a maid's room with a bathroom."],
  ['inbound', 'Thanks, that helps a lot.'],
];

const quote = (value) => `'${String(value).replaceAll("'", "''")}'`;

/** Synthetic earlier messages after the first email, oldest first. */
function addMessages(conversation, workspace, author) {
  query(`UPDATE inbox.crm_inbox_messages SET created_at=now()-interval '3 hours'
    WHERE conversation_id=${quote(conversation)}`);
  const rows = TALK.map(([direction, body], index) => {
    const outbound = direction === 'outbound';
    return `(${quote(randomUUID())},${quote(conversation)},${quote(workspace)},${quote(direction)},
      ${outbound ? "'delivered'" : "'received'"},${outbound ? quote(author) : 'NULL'},${quote(body)},
      now()-interval '${(TALK.length - index) * 9} minutes')`;
  });
  query(`INSERT INTO inbox.crm_inbox_messages (id,conversation_id,workspace_id,direction,status,
    author_user_id,body,created_at) VALUES ${rows.join(',')}`);
}

/** 1280×800 and 390×844 screenshots in both themes. */
async function shoot(page, testInfo, name) {
  for (const size of [SIZES[0], SIZES[2]]) {
    await page.setViewportSize({ width: size.width, height: size.height });
    for (const theme of ['light', 'dark']) {
      await setTheme(page, theme);
      await page.waitForTimeout(300);
      await page.screenshot({ path: testInfo.outputPath(`${name}-${size.width}-${theme}.png`) });
    }
  }
}

/** Attaches a synthetic PDF and types two lines: files show inside the box, "+" beside it. */
async function withFile(page, field, testInfo, name) {
  const file = { name: 'Floor plan.pdf', mimeType: 'application/pdf', buffer: pdf() };
  await page.getByLabel('Attach files').setInputFiles(file);
  await expect(page.locator('.composer-file.is-ready')).toBeVisible();
  await field.fill("Here is the floor plan.\nThe maid's room is on page 2.");
  await shoot(page, testInfo, name);
}

/** The thread's share of the window at each size, with no page scroll; then screenshots. */
async function measure(page, selector, testInfo, name) {
  for (const size of SIZES) {
    await page.setViewportSize({ width: size.width, height: size.height });
    await page.waitForTimeout(300);
    const box = await page.locator(selector).boundingBox();
    const scroll = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
    const share = box.height / size.height;
    console.log(
      `${name} ${size.width}x${size.height}: thread ${Math.round(box.height)}px ` +
        `(${Math.round(share * 100)}%), page scroll ${scroll}px`,
    );
    expect.soft(share).toBeGreaterThanOrEqual(size.share);
    expect.soft(scroll).toBeLessThanOrEqual(1);
  }
  await shoot(page, testInfo, name);
}

test('an Inbox conversation gives the messages most of the window', async ({ page }, testInfo) => {
  const company = await sendgridCompany('size-inbox');
  const { session, domain } = company;
  expect((await connectSendgrid(session, domain)).status).toBe(201);
  expect((await addAddress(session, session.user.id, 'owner', 'Owner')).status).toBe(201);
  const client = await clientWith(session, 'size.inbox.client@example.test');
  const started = await startMessage(session, client);
  expect(started.status).toBe(201);
  const { conversationId } = started.value;
  addMessages(conversationId, session.user.workspaceId, session.user.id);
  await signInMember(page, company.admin.email);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(`/#/inbox?conversation=${conversationId}`);
  const thread = page.locator('.inbox-thread');
  await expect(thread).toContainText('Thanks, that helps a lot.');
  // The reply box starts at one line and grows with the text, then scrolls.
  await page.getByRole('tab', { name: 'Reply' }).click();
  const field = page.getByLabel('Your reply', { exact: true });
  await expect(field).toBeVisible();
  const empty = (await field.boundingBox()).height;
  expect.soft(empty).toBeLessThanOrEqual(48);
  await field.fill('One\nTwo\nThree\nFour');
  expect.soft((await field.boundingBox()).height).toBeGreaterThan(empty + 40);
  await field.fill('');
  await expect.poll(async () => (await field.boundingBox()).height).toBeLessThanOrEqual(empty);
  await measure(page, '.inbox-thread', testInfo, 'size-inbox');
  await withFile(page, field, testInfo, 'size-inbox-files');
});

test('Team chat gives the messages most of the window', async ({ page }, testInfo) => {
  await signIn(page);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/#/team-chat');
  await page.getByRole('button', { name: /#general/ }).click();
  const composer = page.getByLabel('Message', { exact: true });
  for (const [, body] of TALK.slice(0, 5)) {
    await composer.fill(body);
    await composer.press('Enter');
    await expect(page.locator('.chat-thread')).toContainText(body);
  }
  await measure(page, '.chat-thread', testInfo, 'size-chat');
  await withFile(page, composer, testInfo, 'size-chat-files');
});
