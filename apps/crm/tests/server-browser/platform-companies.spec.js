import { test, expect } from './fixtures.js';
import { companyBody, newCompany, putCompany } from '../api/company-helpers.mjs';
import { signIn } from './helpers.js';

test('the Super Admin finds a company on Workspaces and opens its team', async ({ page }) => {
  const { admin } = await newCompany('platform-browser');
  const name = `Synthetic Platform ${Date.now()}`;
  expect((await putCompany(admin, companyBody({ displayName: name }))).status).toBe(200);
  await signIn(page, 'owner');
  await page.goto('/#/workspaces');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Workspaces');
  const table = page.getByRole('table', { name: 'Companies', exact: true });
  await page.getByRole('textbox', { name: 'Search companies' }).fill(name);
  const row = table.getByRole('row').filter({ hasText: name });
  await expect(row).toContainText(admin.user.name);
  await expect(row).toContainText('1 of 3');
  await expect(row).toContainText('Not applied');
  // Archived holds archived companies only.
  await page
    .getByRole('group', { name: 'Filter companies', exact: true })
    .getByRole('button', { name: 'Archived', exact: true })
    .click();
  await expect(table.getByRole('row').filter({ hasText: name })).toHaveCount(0);
  await page
    .getByRole('group', { name: 'Filter companies', exact: true })
    .getByRole('button', { name: 'Archived', exact: true })
    .click();
  await row.getByRole('button', { name: `Open ${name}`, exact: true }).click();
  await expect(page).toHaveURL(/team-access/);
});
