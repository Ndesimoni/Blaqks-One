import { test, expect } from './fixtures.js';
import { memberPage, signInMember } from './assign-helpers.js';
import { shots } from './sendgrid-helpers.js';
import { freshAdmin } from '../api/sendgrid-helpers.mjs';
import { activate, findMember, invite, memberUpdate, teamPath } from '../api/team-helpers.mjs';

// Packet W1a (docs/whatsapp-design.md §16): the company's Twilio account on Channels, the
// Admin giving a member a number (WQ3), and the member's own number on My WhatsApp. Runs
// against the Twilio stand-in (CRM_TWILIO_ENDPOINT): any well-formed SID and token is an
// active account except tokens starting 0000, and each SID lists synthetic +999 senders.
const hex = (length) =>
  Array.from({ length }, () => Math.floor(Math.random() * 16).toString(16)).join('');

/** A fresh company with an Admin and one staff member who has the WhatsApp grant. */
async function whatsappCompany(label) {
  const tag = `${label}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const admin = await freshAdmin(`${tag}-admin`);
  const invited = await invite(admin, `${tag}-agent`);
  const staff = await activate(invited);
  const member = await findMember(admin, staff.user.id);
  const body = memberUpdate(member, { channelAccess: { email: false, whatsapp: true } });
  const updated = await admin.request(teamPath(admin, member.id), { method: 'PATCH', body });
  expect(updated.status, JSON.stringify(updated.value)).toBe(200);
  return {
    admin: `${tag}-admin@team-fixture.test`,
    agent: { email: invited.email, name: `Synthetic ${tag}-agent` },
    sid: `AC${hex(32)}`,
    token: `a${hex(31)}`,
  };
}

/** The open dialog makes the theme switch inert, so its shots set the theme attribute. */
async function dialogShots(page, testInfo, name) {
  const theme = await page.locator('html').getAttribute('data-theme');
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 900 });
    for (const next of ['light', 'dark']) {
      await page.evaluate((value) => (document.documentElement.dataset.theme = value), next);
      await page.waitForTimeout(250);
      await page.screenshot({ path: testInfo.outputPath(`${name}-${width}-${next}.png`) });
    }
  }
  await page.evaluate((value) => (document.documentElement.dataset.theme = value), theme);
  await page.setViewportSize({ width: 1280, height: 900 });
}

const whatsappCard = (page) => page.getByRole('article', { name: 'WhatsApp', exact: true });
const numbersRegion = (page) => page.getByRole('region', { name: "Members' numbers" });

test('an Admin connects Twilio, gives a member a number and disconnects it', async ({
  page,
  browser,
}, testInfo) => {
  const company = await whatsappCompany('w1a-ui');
  await signInMember(page, company.admin);
  await page.goto('/#/channels');
  const card = whatsappCard(page);
  await card.getByRole('button', { name: 'Connect', exact: true }).click();
  const form = card.getByRole('form', { name: 'Connect WhatsApp' });
  await expect(form).toContainText('Find these in your Twilio Console under Account info.');
  await expect(form.getByLabel('Display label')).toHaveValue('Company WhatsApp');
  const sid = form.getByLabel('Account SID');
  const token = form.getByLabel('Auth Token', { exact: true });
  await sid.fill('AC123');
  await form.getByRole('button', { name: 'Connect Twilio' }).click();
  await expect(sid).toHaveAttribute('aria-invalid', 'true');
  await expect(sid).toBeFocused();
  await expect(form).toContainText('Enter the Account SID as Twilio shows it');
  await expect(form).toContainText('Add the Auth Token.');
  await sid.fill(company.sid);
  await token.fill(`0000${hex(28)}`);
  await expect(token).toHaveAttribute('type', 'password');
  await form.getByRole('button', { name: 'Show Auth Token' }).click();
  await expect(token).toHaveAttribute('type', 'text');
  await form.getByRole('button', { name: 'Hide Auth Token' }).click();
  await expect(token).toHaveAttribute('type', 'password');
  await form.getByRole('button', { name: 'Connect Twilio' }).click();
  await expect(form.getByRole('alert')).toContainText('Twilio refused');
  await token.fill(company.token);
  await shots(page, testInfo, 'w1a-connect');
  await form.getByRole('button', { name: 'Connect Twilio' }).click();
  await expect(page.getByText('Company WhatsApp is connected.')).toBeVisible();
  await expect(card.getByText('Connected', { exact: true })).toBeVisible();
  await expect(card).toContainText(`Account SID ending ${company.sid.slice(-4)}`);
  await expect(card).not.toContainText(company.token);

  const numbers = numbersRegion(page);
  await expect(numbers).toContainText('No numbers given yet.');
  await numbers.getByRole('button', { name: 'Give a number' }).click();
  const dialog = page.getByRole('dialog', { name: 'Give a number' });
  const member = dialog.getByLabel('Team member');
  await expect(member).toBeVisible();
  await expect(member.locator('option', { hasText: company.agent.name })).toHaveCount(1);
  await dialog.getByRole('button', { name: 'Give number' }).click();
  await expect(member).toHaveAttribute('aria-invalid', 'true');
  await expect(dialog).toContainText('Choose a team member.');
  await member.selectOption({ label: company.agent.name });
  const sender = dialog.getByLabel('WhatsApp number');
  const phone = await sender.locator('option').nth(1).getAttribute('value');
  expect(phone).toMatch(/^\+999\d+$/);
  await sender.selectOption(phone);
  await dialogShots(page, testInfo, 'w1a-give');
  await dialog.getByRole('button', { name: 'Give number' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(
    numbers.getByText(`${phone} is now the WhatsApp number of ${company.agent.name}.`),
  ).toBeVisible();
  const row = numbers.getByRole('listitem').filter({ hasText: phone });
  await expect(row).toContainText(company.agent.name);
  await expect(row).toContainText('Connected');
  await shots(page, testInfo, 'w1a-numbers');

  // The member sees their own number under Settings → My WhatsApp.
  const agent = await memberPage(browser, company.agent.email);
  await agent.page.goto('/#/my-whatsapp');
  await expect(agent.page.getByRole('heading', { level: 1, name: 'My WhatsApp' })).toBeVisible();
  const mine = agent.page.getByRole('article', { name: 'Your WhatsApp number' });
  await expect(mine).toContainText(phone);
  await expect(mine).toContainText('Connected');
  await shots(agent.page, testInfo, 'w1a-my-whatsapp');

  // The Admin disconnects it after a confirmation; the member then sees no number.
  await row.getByRole('button', { name: `Disconnect ${phone}` }).click();
  const confirm = row.getByRole('group', { name: 'Disconnect number' });
  await expect(confirm).toContainText(`Disconnect ${phone} from ${company.agent.name}?`);
  await confirm.getByRole('button', { name: 'Cancel' }).click();
  await row.getByRole('button', { name: `Disconnect ${phone}` }).click();
  await confirm.getByRole('button', { name: 'Disconnect number' }).click();
  await expect(numbers.getByText(`${phone} is disconnected.`)).toBeVisible();
  await expect(numbers).toContainText('No numbers given yet.');
  await agent.page.reload();
  await expect(mine).toContainText(
    "Your Admin gives you a WhatsApp number from the company's Twilio account.",
  );
  await expect(mine).toContainText('No number yet');
  await agent.context.close();

  // Disconnecting the account says that every member's number goes with it.
  await card.getByRole('button', { name: 'Disconnect', exact: true }).click();
  const off = card.getByRole('group', { name: 'Disconnect channel' });
  await expect(off).toContainText("Every member's WhatsApp number disconnects too");
  await off.getByRole('button', { name: 'Disconnect channel' }).click();
  await expect(page.getByText('Company WhatsApp is disconnected.')).toBeVisible();
  await expect(numbersRegion(page)).toHaveCount(0);
  await expect(card).toContainText('Not connected yet.');
});
