import { expect, test } from './helpers/session.js';

const contacts = [
  { contact_id: 'CT-G1', full_name: 'Gate guard', contact_type: 'Security guard' },
  { contact_id: 'CT-O1', full_name: 'Owner contact', contact_type: 'Owner' },
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

test('demo building managers keep location details through reload, tabs and search', async ({
  page,
}) => {
  await page.goto('/#/contacts');
  const filters = page.getByRole('group', { name: 'Filter Contacts', exact: true });
  const rows = page.locator('.data-table tbody tr');
  const search = page.getByRole('textbox', { name: 'Search Contacts', exact: true });
  await page.getByRole('button', { name: 'Add contact', exact: true }).click();
  const form = page.getByRole('dialog');
  await form.locator('#contact_id').fill('CT-BM1');
  await form.locator('#full_name').fill('Tower manager');
  await form.getByLabel('Contact type', { exact: true }).selectOption('Building manager');
  await form.getByLabel('Building / project', { exact: true }).fill('Creek Vista');
  await form.getByLabel('Community', { exact: true }).fill('Sobha Hartland');
  await form.getByLabel('Emirate', { exact: true }).selectOption('Dubai');
  await page.getByRole('button', { name: 'Create record', exact: true }).click();
  await expect(form).toHaveCount(0);
  await page.reload();
  await expect(page.locator('.data-table thead')).toContainText('Building / project');
  const onlyIn = {
    'Security guards': 'Gate guard',
    'Building managers': 'Tower manager',
    'Other contacts': 'Owner contact',
  };
  for (const [tab, name] of Object.entries(onlyIn)) {
    await filters.getByRole('button', { name: tab, exact: true }).click();
    await expect(rows).toHaveCount(1);
    await expect(rows).toContainText(name);
  }
  await filters.getByRole('button', { name: 'All', exact: true }).click();
  for (const query of ['creek vista', 'HARTLAND']) {
    await search.fill(query);
    await expect(rows).toHaveCount(1);
    await expect(rows).toContainText('Creek Vista');
  }
  await page.getByRole('button', { name: 'Open record CT-BM1', exact: true }).click();
  const labels = await page.locator('.detail-field > span').allTextContents();
  const at = labels.indexOf('Company');
  expect(labels.slice(at, at + 4)).toEqual([
    'Company',
    'Building / project',
    'Community',
    'Emirate',
  ]);
  await expect(page.getByRole('dialog')).toContainText('Sobha Hartland');
});
