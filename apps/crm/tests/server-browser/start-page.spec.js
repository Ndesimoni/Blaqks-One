import { WEBSITE, test, expect } from './fixtures.js';
import { setTheme } from './assign-helpers.js';
import { rail } from './product-nav.js';

const greeting = /^Good (morning|afternoon|evening)/;

test('members land on the start page, open products from it and use the account menu', async ({
  page,
}, testInfo) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await page.getByLabel('Email', { exact: true }).fill('admin-a@crm-fixture.test');
  await page.getByLabel('Password', { exact: true }).fill(process.env.CRM_FIXTURE_PASSWORD);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(/#\/start$/);
  await expect(page.getByRole('heading', { level: 1, name: greeting })).toBeVisible();
  // No section sidebar on the start page; the rail's Home is current.
  await expect(page.locator('#section-sidebar')).toHaveCount(0);
  await expect(rail(page).getByRole('button', { name: 'Home', exact: true })).toHaveAttribute(
    'aria-current',
    'page',
  );
  // The mockup's start page: Get started for the Admin, the date line, figures and quick actions.
  const started = page.getByRole('region', { name: 'Get started' });
  await expect(started).toContainText('Create your workspace');
  await expect(started.getByRole('status')).toHaveText(/^\d of \d done$/);
  await expect(page.locator('.start-hello p')).toContainText('across your clients');
  const crm = page.getByRole('article', { name: 'CRM', exact: true });
  await expect(crm).toContainText('follow-ups due');
  await expect(crm.getByRole('button', { name: 'Add a lead' })).toBeVisible();
  for (const theme of ['light', 'dark']) {
    await setTheme(page, theme);
    await page.screenshot({ path: testInfo.outputPath(`start-${theme}.png`), fullPage: true });
  }
  await expect(page.getByRole('article', { name: 'Websites', exact: true })).toBeVisible();
  const messages = page.getByRole('navigation', { name: 'Messages', exact: true });
  await expect(messages.getByRole('button', { name: 'Client inbox', exact: true })).toBeVisible();
  await expect(messages.locator('.connected-nav-badge, .count')).toHaveCount(0);

  await crm.getByRole('button', { name: 'Open CRM', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Dashboard');
  await expect(rail(page).getByRole('button', { name: 'CRM', exact: true })).toHaveAttribute(
    'aria-current',
    'page',
  );
  await rail(page).getByRole('button', { name: 'Home', exact: true }).click();
  const resume = page.locator('.start-continue');
  await expect(resume).toContainText('CRM · Dashboard');

  const account = page.getByRole('button', { name: /^Account menu/ });
  await account.click();
  await expect(account).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByRole('button', { name: 'My profile', exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(account).toHaveAttribute('aria-expanded', 'false');
  await expect(account).toBeFocused();
  await account.click();
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  // Signing out leaves for the website home.
  await expect(page).toHaveURL(WEBSITE);
  expect(errors).toEqual([]);
});
