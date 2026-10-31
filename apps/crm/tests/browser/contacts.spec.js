import { expect, test } from './helpers/session.js';

const contacts = [
  ...Array.from({ length: 13 }, (_, index) => ({
    contact_id: `CT-L${String(index + 1).padStart(2, '0')}`,
    full_name: `Landlord ${String(index + 1).padStart(2, '0')}`,
    contact_type: 'Landlord',
    company: index % 2 ? 'Harbour Homes' : 'Sunrise Estates',
  })),
  { contact_id: 'CT-C1', full_name: 'Existing client contact', contact_type: 'Client' },
  { contact_id: 'CT-O1', full_name: 'Owner contact', contact_type: 'Owner' },
  { contact_id: 'CT-B1', full_name: 'Broker contact', contact_type: 'Broker' },
  { contact_id: 'CT-R1', full_name: 'Imported referral', contact_type: 'Referral source' },
  { contact_id: 'CT-U1', full_name: 'Unclassified contact' },
];

test.beforeEach(async ({ page }) => {
  await page.addInitScript((records) => {
    if (!localStorage.getItem('kws-crm-v1:workspace:aidah'))
      localStorage.setItem(
        'kws-crm-v1:workspace:aidah',
        JSON.stringify({ data: { Contacts: records }, demo: false }),
      );
  }, contacts);
});

test('contact filters combine with search, reset pagination, and reflect saved category changes', async ({
  page,
}, testInfo) => {
  await page.goto('/#/contacts');
  const filters = page.getByRole('group', { name: 'Filter Contacts', exact: true });
  const rows = page.locator('.data-table tbody tr');
  const search = page.getByRole('textbox', { name: 'Search Contacts', exact: true });
  await expect(rows).toHaveCount(12);
  await expect(page.locator('.table-footer')).toContainText('of 18 records');
  await filters.getByRole('button', { name: 'Landlords', exact: true }).click();
  await expect(page.locator('.table-footer')).toContainText('of 13 records');
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(rows).toHaveCount(1);
  await filters.getByRole('button', { name: 'Clients', exact: true }).click();
  await expect(filters.getByRole('button', { name: 'Clients', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(rows).toHaveCount(1);
  await expect(page.locator('.pager')).toContainText('1 / 1');
  await search.fill('Harbour');
  await expect(rows).toHaveCount(0);
  await expect(page.getByText('No matching records', { exact: true })).toBeVisible();
  await expect(
    page.getByText('Try another search or choose All to show every contact.'),
  ).toBeVisible();
  await search.fill('');
  await page.getByRole('button', { name: 'Add contact', exact: true }).click();
  await page.locator('#contact_id').fill('CT-NEW');
  await page.locator('#full_name').fill('New client contact');
  await page.getByLabel('Contact type', { exact: true }).selectOption('Client');
  await page.getByRole('button', { name: 'Create record', exact: true }).click();
  await expect(rows).toHaveCount(2);
  await page.screenshot({ path: testInfo.outputPath('contacts-client-filter.png') });
  await page.reload();
  await expect(filters.getByRole('button', { name: 'All', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await filters.getByRole('button', { name: 'Clients', exact: true }).click();
  await expect(rows).toHaveCount(2);
  await page.getByRole('button', { name: 'Open record CT-NEW', exact: true }).click();
  await page.getByRole('button', { name: 'Edit record', exact: true }).click();
  await page.getByLabel('Contact type', { exact: true }).selectOption('Landlord');
  await page.getByRole('button', { name: 'Save changes', exact: true }).click();
  await expect(rows).toHaveCount(1);
  await filters.getByRole('button', { name: 'Landlords', exact: true }).click();
  await search.fill('New client contact');
  await expect(rows).toHaveCount(1);
  await expect(rows).toContainText('CT-NEW');
  await search.fill('Harbour');
  await expect(rows).toHaveCount(6);
  await search.fill('');
  await filters.getByRole('button', { name: 'Other contacts', exact: true }).click();
  await expect(rows).toHaveCount(4);
  for (const name of [
    'Owner contact',
    'Broker contact',
    'Imported referral',
    'Unclassified contact',
  ])
    await expect(rows.filter({ hasText: name })).toHaveCount(1);
  await page
    .locator('.sidebar .nav-item')
    .filter({ hasText: /^Clients$/ })
    .click();
  await page
    .locator('.sidebar .nav-item')
    .filter({ hasText: /^Contacts$/ })
    .click();
  await expect(filters.getByRole('button', { name: 'All', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.locator('.table-footer')).toContainText('of 19 records');
});

test('contact filters work with keyboard controls on mobile in both themes without page overflow', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/#/contacts');
  await page.getByRole('button', { name: 'Switch to light mode' }).click();
  const filters = page.getByRole('group', { name: 'Filter Contacts', exact: true });
  await filters.getByRole('button', { name: 'Landlords', exact: true }).focus();
  await page.keyboard.press('Enter');
  await page.getByRole('textbox', { name: 'Search Contacts', exact: true }).fill('Harbour');
  await expect(page.locator('.data-table tbody tr')).toHaveCount(6);
  await page.screenshot({ path: testInfo.outputPath('contacts-mobile-light.png') });
  await page.getByRole('button', { name: 'Switch to dark mode' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  for (const name of [
    'All',
    'Landlords',
    'Clients',
    'Security guards',
    'Building managers',
    'Other contacts',
  ])
    await expect(filters.getByRole('button', { name, exact: true })).toBeInViewport();
  await page.getByRole('textbox', { name: 'Search Contacts', exact: true }).fill('');
  await filters.getByRole('button', { name: 'Other contacts', exact: true }).click();
  await expect(page.locator('.data-table tbody tr')).toHaveCount(4);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.locator('.table-footer').scrollIntoViewIfNeeded();
  await expect(page.getByRole('button', { name: 'Previous', exact: true })).toBeInViewport();
  await expect(page.getByRole('button', { name: 'Next', exact: true })).toBeInViewport();
  await page
    .getByRole('button', { name: 'Open record CT-O1', exact: true })
    .scrollIntoViewIfNeeded();
  await expect(
    page.getByRole('button', { name: 'Open record CT-O1', exact: true }),
  ).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('contacts-mobile-dark.png'), fullPage: true });
});
