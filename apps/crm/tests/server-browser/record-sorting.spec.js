import { add } from '../api/assignment-helpers.mjs';
import { login } from '../api/helpers.mjs';
import { expect, test } from './fixtures.js';
import { signIn } from './helpers.js';

const cards = (page) => page.locator('.record-card');

async function sortControls(page) {
  await page.getByRole('button', { name: 'Sort records', exact: true }).click();
  const controls = page.getByRole('group', { name: 'Record sorting', exact: true });
  await expect(controls).toBeVisible();
  const bounds = await controls.boundingBox();
  expect(bounds.x).toBeGreaterThanOrEqual(0);
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(page.viewportSize().width);
  return controls;
}

test('phone sorting changes record order, resets pagination and survives desktop resize', async ({
  page,
}) => {
  const admin = await login();
  for (let index = 1; index <= 14; index++) {
    const suffix = String(index).padStart(2, '0');
    await add(admin, 'Clients', {
      client_id: `SORT-${suffix}`,
      full_name: `Sort fixture ${suffix}`,
      lead_stage: 'New',
    });
  }
  await signIn(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('textbox', { name: 'Search Clients', exact: true }).fill('Sort fixture');
  let controls = await sortControls(page);
  await controls
    .getByRole('combobox', { name: 'Sort by', exact: true })
    .selectOption({ label: 'Full name' });
  await controls
    .getByRole('combobox', { name: 'Sort direction', exact: true })
    .selectOption('desc');
  await expect(cards(page).first()).toContainText('Sort fixture 14');
  await expect(cards(page)).toHaveCount(12);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Sort records', exact: true })).toBeFocused();
  const pager = page.getByRole('navigation', { name: 'Clients pages', exact: true });
  await pager.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(cards(page)).toHaveCount(2);
  controls = await sortControls(page);
  await controls.getByRole('combobox', { name: 'Sort direction', exact: true }).selectOption('asc');
  await expect(cards(page)).toHaveCount(12);
  await expect(cards(page).first()).toContainText('Sort fixture 01');
  await expect(pager).toContainText('Showing 1–12 of 14');
  await page.keyboard.press('Escape');
  await page.setViewportSize({ width: 1280, height: 800 });
  const table = page.getByRole('table', { name: 'Clients records', exact: true });
  await expect(table.getByRole('columnheader', { name: 'Full name' })).toHaveAttribute(
    'aria-sort',
    'ascending',
  );
  await expect(table.locator('tbody tr').first()).toContainText('Sort fixture 01');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/#/leads');
  await page.getByRole('textbox', { name: 'Search leads' }).fill('Sort fixture');
  controls = await sortControls(page);
  await controls
    .getByRole('combobox', { name: 'Sort by', exact: true })
    .selectOption({ label: 'Full name' });
  await controls
    .getByRole('combobox', { name: 'Sort direction', exact: true })
    .selectOption('desc');
  await expect(cards(page).first()).toContainText('Sort fixture 14');
});

test('Contacts expose the same phone sorting controls', async ({ page }) => {
  const admin = await login();
  for (const name of ['Alpha', 'Zulu']) {
    await add(admin, 'Contacts', {
      contact_id: `SORT-${name.toUpperCase()}`,
      full_name: `Contact sort ${name}`,
      contact_type: 'Landlord',
    });
  }
  await signIn(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/#/contacts');
  await page.getByRole('textbox', { name: 'Search Contacts', exact: true }).fill('Contact sort');
  const controls = await sortControls(page);
  await controls
    .getByRole('combobox', { name: 'Sort by', exact: true })
    .selectOption({ label: 'Full name' });
  await controls
    .getByRole('combobox', { name: 'Sort direction', exact: true })
    .selectOption('desc');
  await expect(cards(page).first()).toContainText('Contact sort Zulu');
  await controls.getByRole('combobox', { name: 'Sort direction', exact: true }).selectOption('asc');
  await expect(cards(page).first()).toContainText('Contact sort Alpha');
  await page.keyboard.press('Escape');
  await page.setViewportSize({ width: 320, height: 800 });
  await sortControls(page);
});
