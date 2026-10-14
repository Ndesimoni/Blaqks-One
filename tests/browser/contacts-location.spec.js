import { expect, test } from './helpers/session.js';

const mapLink = 'https://maps.google.com/?q=Creek%20Vista%20Tower%20B';
const contacts = [
  { contact_id: 'CT-G1', full_name: 'Gate guard', contact_type: 'Security guard' },
  {
    contact_id: 'CT-O1',
    full_name: 'Owner contact',
    contact_type: 'Owner',
    map_link: 'javascript:alert(1)',
  },
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
  await form.getByLabel('Address', { exact: true }).fill('Tower B lobby, Creek Vista');
  const map = form.getByLabel('Map link', { exact: true });
  await expect(map).toHaveAttribute('type', 'url');
  await expect(map).toHaveAttribute('placeholder', 'https://maps.google.com/…');
  await map.fill('maps.google.com/?q=Creek');
  const create = page.getByRole('button', { name: 'Create record', exact: true });
  await create.click();
  await expect(form.locator('#map_link-error')).toHaveText(
    'Enter a complete http:// or https:// URL.',
  );
  await expect(map).toBeFocused();
  await map.fill(mapLink);
  await create.click();
  await expect(form).toHaveCount(0);
  await page.reload();
  const head = page.locator('.data-table thead');
  await expect(head).toContainText('Building / project');
  await expect(head).not.toContainText(/Address|Map link/);
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
  for (const query of ['creek vista', 'HARTLAND', 'tower b lobby']) {
    await search.fill(query);
    await expect(rows).toHaveCount(1);
    await expect(rows).toContainText('Creek Vista');
  }
  await page.getByRole('button', { name: 'Open record CT-BM1', exact: true }).click();
  const labels = await page.locator('.detail-field > span').allTextContents();
  const at = labels.indexOf('Company');
  expect(labels.slice(at, at + 6)).toEqual([
    'Company',
    'Building / project',
    'Community',
    'Emirate',
    'Address',
    'Map link',
  ]);
  const details = page.getByRole('dialog');
  await expect(details).toContainText('Sobha Hartland');
  await expect(details).toContainText('Tower B lobby, Creek Vista');
  const open = details.getByRole('link', { name: 'Open map', exact: true });
  await expect(open).toHaveAttribute('href', mapLink);
  await expect(open).toHaveAttribute('target', '_blank');
  await expect(open).toHaveAttribute('rel', 'noopener noreferrer');
});

test('demo contact details never link an unsafe imported map value', async ({ page }) => {
  await page.goto('/#/contacts');
  await page.getByRole('button', { name: 'Open record CT-O1', exact: true }).click();
  const details = page.getByRole('dialog');
  await expect(details).toContainText('javascript:alert(1)');
  await expect(details.getByRole('link')).toHaveCount(0);
});
