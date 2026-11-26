import { memberPage } from './assign-helpers.js';
import { expect, test } from './fixtures.js';
import { assignTeam, held } from './permissions-fixtures.js';

const label = 'Search clients, contacts and properties';

test('search finds the people and listings in scope and opens the chosen record', async ({
  browser,
}, testInfo) => {
  const team = await assignTeam('search');
  const { admin, one } = team.people;
  await held(team, 'Clients', { full_name: 'Searchable Layla' }, one.id);
  await held(team, 'Clients', { full_name: 'Searchable Omar' });
  await held(team, 'Contacts', { full_name: 'Searchable landlord' });
  await held(team, 'Properties', { listing_title: 'Searchable tower' });
  const owner = await memberPage(browser, admin.email);
  try {
    const { page } = owner;
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const field = page.getByRole('searchbox', { name: label });
    const dropdown = page.locator('.search-dropdown');
    await field.fill('s');
    await expect(dropdown).toHaveCount(0);
    await field.fill('searchable');
    const clients = dropdown.getByRole('region', { name: 'Clients' });
    await expect(clients.locator('.search-count')).toHaveText('2');
    await expect(clients.locator('mark').first()).toHaveText('Searchable');
    await expect(dropdown.getByRole('region', { name: 'Contacts' })).toContainText('landlord');
    await expect(dropdown.getByRole('button', { name: 'See all 4 matches' })).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath('search-dropdown.png') });
    await field.press('ArrowDown');
    await expect(dropdown.locator('.search-hit').first()).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(dropdown).toHaveCount(0);
    await expect(field).toBeFocused();
    await field.press('ArrowDown');
    await expect(dropdown.locator('.search-hit')).toHaveCount(4);
    // Escape in the field itself also clears it, as search fields do.
    await field.press('Escape');
    await expect(dropdown).toHaveCount(0);
    await expect(field).toHaveValue('');

    await field.fill('searchable');
    await field.press('Enter');
    const panel = page.getByRole('dialog', { name: 'Search', exact: true });
    await expect(panel.getByRole('status')).toHaveText('4 matches for “searchable”');
    await expect(panel.getByRole('searchbox', { name: label })).toBeFocused();
    await page.screenshot({ path: testInfo.outputPath('search-panel.png') });
    await panel.getByRole('button', { name: /Searchable tower/ }).click();
    await expect(panel).toHaveCount(0);
    const record = page.getByRole('dialog', { name: 'Searchable tower' });
    await expect(record).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(record).toHaveCount(0);
    await expect(field).toBeFocused();
  } finally {
    await owner.context.close();
  }
  // Assigned-only staff search only what their scope already gives them.
  const staff = await memberPage(browser, one.email);
  try {
    await staff.page.getByRole('searchbox', { name: label }).fill('searchable');
    const dropdown = staff.page.locator('.search-dropdown');
    await expect(dropdown).toContainText('Searchable Layla');
    await expect(dropdown).not.toContainText('Searchable Omar');
    await expect(dropdown).not.toContainText('Searchable landlord');
  } finally {
    await staff.context.close();
  }
});
