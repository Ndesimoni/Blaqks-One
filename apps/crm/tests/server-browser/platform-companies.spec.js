import { test, expect } from './fixtures.js';
import { companyBody, newCompany, putCompany } from '../api/company-helpers.mjs';
import { signIn } from './helpers.js';

test('Blaqks One finds a company and controls its people from the company panel (BO1a)', async ({
  page,
}) => {
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
  // The company panel: its people and seats, never its records, and no switching into it.
  const panel = page.getByRole('dialog', { name, exact: true });
  await expect(panel).toContainText(`Admin: ${admin.user.name}`);
  await expect(panel).toContainText('1 of 3');
  await expect(panel).toContainText("never the company's clients, deals or messages");
  const people = panel.getByRole('region', { name: 'People', exact: true });
  await expect(people.getByRole('listitem')).toHaveCount(1);
  await expect(people).toContainText(admin.user.email);
  const suspend = people.getByRole('button', { name: `Suspend ${admin.user.name}`, exact: true });
  await suspend.click();
  await expect(page.locator('.toast')).toContainText(`${admin.user.name} is suspended`);
  await expect(people).toContainText('Suspended');
  await people.getByRole('button', { name: `Reactivate ${admin.user.name}`, exact: true }).click();
  await expect(people).toContainText('Active');
  await panel.getByRole('button', { name: 'Change seat limit', exact: true }).click();
  const seats = page.getByRole('dialog', { name: 'Change company seat limit' });
  await expect(seats).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page).toHaveURL(/workspaces/);
});
