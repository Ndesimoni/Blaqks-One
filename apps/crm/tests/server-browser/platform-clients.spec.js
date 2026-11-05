import { test, expect } from './fixtures.js';
import { signIn } from './helpers.js';
import { noPageOverflow, setTheme } from './assign-helpers.js';

const noAccess = (page) => page.getByRole('heading', { name: /^You don't have access to / });

// BO1e (docs/blaqks-one-console.md §9): Blaqks One's own sales clients, worked by its team on
// Platform → Clients, with Call, WhatsApp, Email and Text opening the phone's apps.
test('the Owner adds a Blaqks One client, moves its stage and logs a call', async ({
  page,
}, testInfo) => {
  test.setTimeout(150000);
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const company = `Synthetic Brokerage ${Date.now()}`;
  const shot = (name) => page.screenshot({ path: testInfo.outputPath(`${name}.png`) });
  await page.setViewportSize({ width: 1280, height: 900 });
  await signIn(page, 'owner');
  await setTheme(page, 'light');
  await page
    .getByRole('navigation', { name: 'Products' })
    .getByRole('button', { name: 'Platform', exact: true })
    .click();
  await page
    .getByRole('navigation', { name: 'Platform sections' })
    .getByRole('button', { name: 'Clients', exact: true })
    .click();
  await expect(page).toHaveURL(/#\/platform-clients$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Clients');

  await page.getByRole('button', { name: 'Add client', exact: true }).click();
  const form = page.getByRole('dialog', { name: 'Add a client' });
  await form.getByLabel('Company name').fill(company);
  await form.getByLabel('Contact name').fill('Synthetic Contact');
  await form.getByLabel('Phone').fill('+971 50 123 4567');
  await form.getByLabel('Email').fill('contact@synthetic-brokerage.test');
  await form.getByLabel('Source').selectOption('referral');
  await shot('client-form-1280-light');
  await form.getByRole('button', { name: 'Add client', exact: true }).click();
  await expect(page.locator('.toast')).toContainText(`Added ${company}`);

  // The new client opens in the slider: name, "Company · Source" and the stage track.
  const panel = page.getByRole('dialog', { name: 'Synthetic Contact' });
  await expect(panel).toContainText(`${company} · Referral`);
  await expect(panel.getByRole('list', { name: 'Stage: New' })).toBeVisible();
  const link = (name) => panel.getByRole('link', { name: `${name} Synthetic Contact` });
  await expect(link('Call')).toHaveAttribute('href', 'tel:+971501234567');
  await expect(link('WhatsApp')).toHaveAttribute('href', 'https://wa.me/971501234567');
  await expect(link('Email')).toHaveAttribute('href', 'mailto:contact@synthetic-brokerage.test');
  await expect(link('Text')).toHaveAttribute('href', 'sms:+971501234567');

  await panel.getByRole('button', { name: 'Move to Contacted', exact: true }).click();
  await expect(panel.getByRole('list', { name: 'Stage: Contacted' })).toBeVisible();
  await expect(panel.getByRole('button', { name: 'Move to Demo booked' })).toBeVisible();

  const log = panel.getByRole('form', { name: 'Log a call, message or note' });
  await log.getByLabel('Type').selectOption('call');
  await log.getByLabel('What happened').fill('Called about a demo next week.');
  await log.getByRole('button', { name: 'Log it', exact: true }).click();
  const timeline = panel.getByRole('region', { name: 'Activity' });
  await expect(timeline).toContainText('Called about a demo next week.');
  await expect(timeline.getByRole('listitem').first()).toContainText('Call');
  await expect(timeline).toContainText('Stage changed');
  await expect(log.getByLabel('What happened')).toHaveValue('');
  await shot('client-slider-1280-light');
  await page.keyboard.press('Escape');
  await expect(panel).toHaveCount(0);

  // The grid finds it under Contacted.
  await page
    .getByRole('group', { name: 'Filter clients' })
    .getByRole('button', { name: /^Contacted/ })
    .click();
  await page.getByRole('textbox', { name: 'Search clients', exact: true }).fill(company);
  const row = page
    .getByRole('table', { name: 'Blaqks One clients', exact: true })
    .getByRole('row')
    .filter({ hasText: company });
  await expect(row).toContainText('Synthetic Contact');
  await expect(row).toContainText('Contacted');
  await expect(row).toContainText('Referral');
  await noPageOverflow(page);
  await shot('clients-1280-light');
  await setTheme(page, 'dark');
  await shot('clients-1280-dark');
  await row.getByRole('button', { name: `${company}, open client`, exact: true }).click();
  await expect(panel.getByRole('list', { name: 'Stage: Contacted' })).toBeVisible();
  await shot('client-slider-1280-dark');
  await page.keyboard.press('Escape');

  // Phones show one card per client, and the slider fills the screen.
  await page.setViewportSize({ width: 390, height: 844 });
  for (const theme of ['dark', 'light']) {
    await setTheme(page, theme);
    const cards = page.getByRole('list', { name: 'Blaqks One clients', exact: true });
    await expect(cards).toContainText(company);
    await noPageOverflow(page);
    await shot(`clients-390-${theme}`);
  }
  await page.getByRole('button', { name: `${company}, open client`, exact: true }).click();
  await expect(link('Call')).toBeVisible();
  await shot('client-slider-390-light');
  expect(errors).toEqual([]);
});

test('a company Admin cannot open Blaqks One clients or read them', async ({ page }) => {
  const asked = [];
  page.on('request', (request) => {
    if (request.url().includes('/platform/clients')) asked.push(request.url());
  });
  await signIn(page, 'admin-a');
  await page.goto('/#/platform-clients');
  await expect(noAccess(page)).toBeVisible();
  expect(asked).toEqual([]);
  const refused = await page.request.get('/api/crm/platform/clients');
  expect(refused.status()).toBe(403);
});
