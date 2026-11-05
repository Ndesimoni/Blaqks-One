import { expect, test } from './helpers/session.js';
import { readFile } from 'node:fs/promises';
import { saveRecordForm } from './helpers/record-form.js';

const leads = [
  ...Array.from({ length: 13 }, (_, index) => ({
    client_id: `CL-I${String(index + 1).padStart(2, '0')}`,
    full_name: `Instagram lead ${String(index + 1).padStart(2, '0')}`,
    phone: '+971 50 000 0200',
    email: `lead${index}@example.com`,
    lead_source: index ? 'Instagram' : ' instagram ',
    campaign_reference: index % 2 ? 'Marina launch' : 'Downtown launch',
    lead_stage: index < 2 ? 'Qualified' : 'New',
    date_added: '2026-10-08',
  })),
  {
    client_id: 'CL-P1',
    full_name: 'Imported portal lead',
    lead_source: 'Legacy portal',
    lead_stage: 'Imported stage',
  },
  { client_id: 'CL-U1', full_name: 'Unrecorded source lead', lead_stage: 'Closed' },
];

test.beforeEach(async ({ page }) => {
  await page.addInitScript((records) => {
    if (!localStorage.getItem('kws-crm-v1:workspace:aidah'))
      localStorage.setItem(
        'kws-crm-v1:workspace:aidah',
        JSON.stringify({ data: { Clients: records }, demo: false }),
      );
  }, leads);
});

test('Leads navigation exposes source totals, imported information and combined paginated filters', async ({
  page,
}) => {
  await page.goto('/');
  await page
    .locator('.sidebar .nav-item')
    .filter({ hasText: /^Leads$/ })
    .click();
  await expect(page).toHaveURL(/#\/leads$/);
  await expect(page.locator('.page-heading h1')).toHaveText('Leads & sources');
  const sources = page.getByRole('group', { name: 'Filter leads by source', exact: true });
  const rows = page.locator('.data-table tbody tr');
  await expect(sources.getByRole('button', { name: 'Instagram 13', exact: true })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Lead source', exact: true })).toBeVisible();
  await expect(
    page.getByRole('columnheader', { name: 'Campaign reference', exact: true }),
  ).toBeVisible();
  await sources.getByRole('button', { name: 'Instagram 13', exact: true }).click();
  await expect(page.locator('.table-footer')).toContainText('of 13 records');
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(rows).toHaveCount(1);
  await page.getByRole('combobox', { name: 'Lead stage', exact: true }).selectOption('Qualified');
  await expect(rows).toHaveCount(2);
  await expect(page.locator('.pager')).toContainText('1 / 1');
  await page.getByRole('textbox', { name: 'Search leads', exact: true }).fill('Marina launch');
  await expect(rows).toHaveCount(1);
  await expect(rows).toContainText('CL-I02');
  await page.getByRole('textbox', { name: 'Search leads', exact: true }).fill('No such campaign');
  await expect(page.getByText('No matching leads', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Clear filters', exact: true }).click();
  await sources.getByRole('button', { name: 'Legacy portal 1', exact: true }).click();
  await page
    .getByRole('combobox', { name: 'Lead stage', exact: true })
    .selectOption('Imported stage');
  await expect(rows).toContainText('Imported portal lead');
  await page.getByRole('button', { name: 'Open record CL-P1', exact: true }).click();
  await page.getByRole('button', { name: 'Edit lead', exact: true }).click();
  await page.locator('#lead_source').selectOption('Other');
  await page.getByRole('button', { name: 'Step 4: Qualification & progress', exact: true }).click();
  await page.locator('#lead_stage').selectOption('New');
  await saveRecordForm(page);
  await expect(
    sources.getByRole('button', { name: 'Legacy portal 0', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('combobox', { name: 'Lead stage', exact: true })).toHaveValue(
    'Imported stage',
  );
  await expect(page.getByText('No matching leads', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Clear filters', exact: true }).click();
  await sources.getByRole('button', { name: 'Other 1', exact: true }).click();
  await expect(rows).toContainText('Imported portal lead');
  await page.getByRole('button', { name: 'Clear filters', exact: true }).click();
  await sources.getByRole('button', { name: 'Not recorded 1', exact: true }).click();
  await expect(rows).toContainText('Unrecorded source lead');
  await page.reload();
  await expect(page.locator('.page-heading h1')).toHaveText('Leads & sources');
  await expect(page.locator('.table-footer')).toContainText('of 15 records');
});

test('lead creation, edits and deletion share one persistent client profile and preserve backup compatibility', async ({
  page,
}) => {
  test.setTimeout(60000);
  await page.goto('/#/leads');
  const sources = page.getByRole('group', { name: 'Filter leads by source', exact: true });
  await sources.getByRole('button', { name: 'Instagram 13', exact: true }).click();
  await page.getByRole('button', { name: 'Add lead', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toHaveAccessibleName('New lead');
  await expect(page.locator('#lead_source')).toHaveValue('Instagram');
  await page.locator('#client_id').fill('CL-NEW-LEAD');
  await page.locator('#full_name').fill('New enquiry');
  await page.locator('#phone').fill('+971 50 555 0142');
  await page.locator('#email').fill('enquiry@example.com');
  await page.locator('#campaign_reference').fill('October open house');
  await saveRecordForm(page);
  await expect(dialog).toHaveCount(0);
  await expect(sources.getByRole('button', { name: 'Instagram 14', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.getByRole('textbox', { name: 'Search leads', exact: true }).fill('October open house');
  await expect(page.locator('.data-table tbody tr')).toHaveCount(1);
  await expect(page.locator('.data-table tbody tr')).toContainText('New');
  await page.reload();
  await page.getByRole('textbox', { name: 'Search leads', exact: true }).fill('CL-NEW-LEAD');
  await page.getByRole('button', { name: 'Open record CL-NEW-LEAD', exact: true }).click();
  await expect(dialog).toContainText('October open house');
  await expect(dialog).toContainText('enquiry@example.com');
  await page.getByRole('button', { name: 'Edit lead', exact: true }).click();
  await page.locator('#lead_source').selectOption('Website');
  await page.locator('#campaign_reference').fill('Website enquiry');
  await dialog
    .getByRole('button', { name: 'Step 4: Qualification & progress', exact: true })
    .click();
  await page.locator('#lead_stage').selectOption('Contacted');
  await saveRecordForm(page);
  await expect(dialog).toHaveCount(0);
  await expect(page.locator('.data-table tbody tr')).toContainText('Website');
  await expect(page.locator('.data-table tbody tr')).toContainText('Contacted');
  await expect(sources.getByRole('button', { name: 'Instagram 13', exact: true })).toBeVisible();
  await expect(sources.getByRole('button', { name: 'Website 1', exact: true })).toBeVisible();
  await page
    .locator('.sidebar .nav-item')
    .filter({ hasText: /^Clients$/ })
    .click();
  await page.getByRole('textbox', { name: 'Search Clients', exact: true }).fill('CL-NEW-LEAD');
  await expect(page.locator('.data-table tbody tr')).toHaveCount(1);
  await expect(page.locator('.data-table tbody tr')).toContainText('New enquiry');
  await expect(page.locator('.data-table tbody tr')).toContainText('Contacted');
  await page
    .locator('.sidebar .nav-item')
    .filter({ hasText: /^Leads$/ })
    .click();
  await page.getByRole('button', { name: 'Data & export', exact: true }).click();
  const downloaded = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Full backup with photos (JSON)', exact: true }).click();
  const backup = JSON.parse(await readFile(await (await downloaded).path(), 'utf8'));
  expect(backup.version).toBe(2);
  expect(backup.data.Leads).toBeUndefined();
  const saved = backup.data.Clients.filter((record) => record.client_id === 'CL-NEW-LEAD');
  expect(saved).toHaveLength(1);
  expect(saved[0]).toMatchObject({
    lead_source: 'Website',
    campaign_reference: 'Website enquiry',
    lead_stage: 'Contacted',
  });
  await page.getByRole('textbox', { name: 'Search leads', exact: true }).fill('CL-NEW-LEAD');
  await page.getByRole('button', { name: 'Open record CL-NEW-LEAD', exact: true }).click();
  page.once('dialog', (event) => event.accept());
  await dialog.getByRole('button', { name: 'Delete', exact: true }).click();
  await page.reload();
  await page.getByRole('textbox', { name: 'Search leads', exact: true }).fill('CL-NEW-LEAD');
  await expect(page.locator('.data-table tbody tr')).toHaveCount(0);
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem('kws-crm-v1:workspace:aidah')).data.Clients.filter(
          (record) => record.client_id === 'CL-NEW-LEAD',
        ).length,
    ),
  ).toBe(0);
});

test('Leads source filters, themes and navigation stay accessible on mobile', async ({
  page,
}, testInfo) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Switch to light mode', exact: true }).click();
  await page.getByRole('button', { name: 'Toggle navigation', exact: true }).click();
  await page
    .locator('.sidebar .nav-item')
    .filter({ hasText: /^Leads$/ })
    .click();
  await expect(page.getByRole('dialog', { name: 'CRM navigation' })).toHaveCount(0);
  const source = page.getByRole('button', { name: 'Not recorded 1', exact: true });
  await source.focus();
  await page.keyboard.press('Enter');
  await expect(source).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.data-table tbody tr')).toHaveCount(1);
  await page.getByRole('combobox', { name: 'Lead stage', exact: true }).selectOption('Closed');
  await expect(page.locator('.data-table tbody tr')).toContainText('Unrecorded source lead');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('leads-mobile-light.png'), fullPage: true });
  await page.getByRole('button', { name: 'Switch to dark mode', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  const colors = await source.evaluate((element) => {
    const background = getComputedStyle(element).backgroundColor;
    const foreground = getComputedStyle(element).color;
    return { background, foreground };
  });
  expect(colors.background).not.toBe('rgb(255, 255, 255)');
  await page.screenshot({ path: testInfo.outputPath('leads-mobile-dark.png'), fullPage: true });
  await page.getByRole('button', { name: 'Clear filters', exact: true }).click();
  await page.getByRole('button', { name: 'Add lead', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveAccessibleName('New lead');
  await expect(page.getByRole('dialog').locator('.form-progress')).toContainText('Step 1 of 6');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('More shows every source filter and closes after selection, outside interaction or explicit dismissal', async ({
  page,
}, testInfo) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/#/leads');
  await page.getByRole('button', { name: 'Switch to light mode', exact: true }).click();
  await page.evaluate(() => {
    const workspace = JSON.parse(localStorage.getItem('kws-crm-v1:workspace:aidah'));
    workspace.data.Clients.push(
      { client_id: 'CL-S1', full_name: 'Bayut enquiry', lead_source: 'Bayut' },
      { client_id: 'CL-S2', full_name: 'Referral enquiry', lead_source: 'Referral' },
      { client_id: 'CL-S3', full_name: 'Website enquiry', lead_source: 'Website' },
    );
    localStorage.setItem('kws-crm-v1:workspace:aidah', JSON.stringify(workspace));
  });
  await page.reload();
  const sources = page.getByRole('group', { name: 'Filter leads by source', exact: true });
  const more = page.getByRole('button', { name: 'More', exact: true });
  await expect(sources.getByRole('button')).toHaveCount(6);
  await expect(more).toHaveAttribute('aria-expanded', 'false');
  await expect(sources.getByRole('button', { name: 'Website 1', exact: true })).toHaveCount(0);
  await page.screenshot({
    path: testInfo.outputPath('leads-source-filters-collapsed.png'),
    fullPage: true,
  });
  await more.focus();
  await page.keyboard.press('Enter');
  const menu = page.getByRole('group', { name: 'All lead sources', exact: true });
  await expect(menu).toBeVisible();
  await expect(menu.getByRole('button', { name: 'Bayut 1', exact: true })).toBeVisible();
  await expect(menu.getByRole('button', { name: 'Instagram 13', exact: true })).toBeVisible();
  await expect(more).toHaveAttribute('aria-expanded', 'true');
  await expect(more).toHaveAttribute('aria-controls', await menu.getAttribute('id'));
  await expect(menu.getByRole('button', { name: 'All sources 18', exact: true })).toBeFocused();
  await expect(sources.getByRole('button')).toHaveCount(6);
  const mobileMenuBox = await menu.boundingBox();
  expect(mobileMenuBox.x).toBeGreaterThanOrEqual(16);
  expect(mobileMenuBox.x + mobileMenuBox.width).toBeLessThanOrEqual(374);
  await page.screenshot({
    path: testInfo.outputPath('leads-more-menu-mobile-light.png'),
    fullPage: true,
  });
  await menu.getByRole('button', { name: 'Website 1', exact: true }).click();
  await expect(menu).toHaveCount(0);
  await expect(more).toHaveAttribute('aria-expanded', 'false');
  await expect(page.locator('.data-table tbody tr')).toHaveCount(1);
  await expect(page.locator('.data-table tbody tr')).toContainText('Website enquiry');
  await page.getByRole('button', { name: 'Switch to dark mode', exact: true }).click();
  await more.click();
  await expect(menu).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath('leads-more-menu-mobile-dark.png'),
    fullPage: true,
  });
  const search = page.getByRole('textbox', { name: 'Search leads', exact: true });
  const searchBox = await search.boundingBox();
  // Use the exposed part of the input, outside the floating menu.
  await search.click({ position: { x: searchBox.width - 8, y: 10 } });
  await expect(menu).toHaveCount(0);
  await expect(page.getByRole('textbox', { name: 'Search leads', exact: true })).toBeFocused();
  await expect(sources.getByRole('button')).toHaveCount(6);
  await expect(sources.getByRole('button', { name: 'Website 1', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.locator('.data-table tbody tr')).toHaveCount(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

  await more.click();
  await page.keyboard.press('Escape');
  await expect(menu).toHaveCount(0);
  await expect(more).toBeFocused();
  await more.click();
  await page.getByRole('button', { name: 'Close source filters', exact: true }).click();
  await expect(menu).toHaveCount(0);
  await expect(more).toBeFocused();
  await more.click();
  await more.click();
  await expect(menu).toHaveCount(0);
  await expect(more).toHaveAttribute('aria-expanded', 'false');
  await more.click();
  await menu.getByRole('button', { name: 'All sources 18', exact: true }).click();
  await expect(menu).toHaveCount(0);
  await expect(page.locator('.table-footer')).toContainText('of 18 records');

  await page.setViewportSize({ width: 1280, height: 900 });
  await more.click();
  await expect(menu).toBeVisible();
  const desktopMenuBox = await menu.boundingBox();
  expect(desktopMenuBox.x).toBeGreaterThanOrEqual(16);
  expect(desktopMenuBox.x + desktopMenuBox.width).toBeLessThanOrEqual(1264);
  await page.screenshot({
    path: testInfo.outputPath('leads-more-menu-desktop-dark.png'),
    fullPage: true,
  });
  await page.getByRole('combobox', { name: 'Lead stage', exact: true }).focus();
  await expect(menu).toHaveCount(0);

  // Exactly six filters need no disclosure control.
  await page.evaluate(() => {
    const workspace = JSON.parse(localStorage.getItem('kws-crm-v1:workspace:aidah'));
    workspace.data.Clients = workspace.data.Clients.filter(
      (record) => record.lead_source !== 'Website',
    );
    localStorage.setItem('kws-crm-v1:workspace:aidah', JSON.stringify(workspace));
  });
  await page.reload();
  await expect(sources.getByRole('button')).toHaveCount(6);
  await expect(more).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
