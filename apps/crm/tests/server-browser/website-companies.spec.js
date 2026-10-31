import { test, expect } from './fixtures.js';
import { signIn } from './helpers.js';
import { signInMember } from './assign-helpers.js';
import { ok } from '../api/website-helpers.mjs';
import { settingsTeam } from './website-settings-helpers.js';

const LIST = '/platform/websites/companies';
const listed = async (team) =>
  ok(await team.owner.request(LIST)).sites.find(
    (site) => site.workspace === team.admin.user.workspaceId,
  );

async function openCompanies(page) {
  await page.goto('/#/platform-website');
  await expect(page.locator('.page-heading h1')).toHaveText('Platform website');
  const tab = page.getByRole('tab', { name: /^Companies/ });
  await tab.click();
  await expect(tab).toHaveAttribute('aria-selected', 'true');
  return page.getByRole('tabpanel', { name: /^Companies/ });
}

test('the Super Admin finds a company and turns its licence off after the impact warning', async ({
  page,
}) => {
  const team = await settingsTeam('companies');
  await signIn(page, 'owner');
  const panel = await openCompanies(page);
  await panel.getByLabel('Search companies', { exact: true }).fill(team.company.host);
  const row = panel.getByRole('row').filter({ hasText: team.company.host });
  await expect(row).toHaveCount(1);
  await expect(row).toContainText('Synthetic Harbour Property');
  await expect(row.getByText('Yes', { exact: true })).toHaveCount(2);
  await row.getByRole('button', { name: /^Edit eligibility/ }).click();
  const dialog = page.getByRole('dialog', { name: 'Edit eligibility' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Save eligibility' })).toBeDisabled();
  await dialog.getByRole('checkbox', { name: 'Licence verified' }).uncheck();
  await expect(dialog.getByText(/listings leave both websites now\./)).toBeVisible();
  await dialog.getByRole('button', { name: 'Turn off and save', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(
    panel.getByRole('status').filter({ hasText: /Eligibility saved for/ }),
  ).toBeVisible();
  await expect(row.getByText('No', { exact: true })).toHaveCount(1);
  const saved = await listed(team);
  expect(saved.licenceVerified).toBe(false);
  expect(saved.entitled).toBe(true);
  expect(saved.version).toBe(team.company.version + 1);
});

test('a stale company version reloads the latest values and keeps the dialog open', async ({
  page,
}) => {
  const team = await settingsTeam('companies-stale');
  await signIn(page, 'owner');
  const panel = await openCompanies(page);
  await panel.getByLabel('Search companies', { exact: true }).fill(team.company.host);
  const row = panel.getByRole('row').filter({ hasText: team.company.host });
  await row.getByRole('button', { name: /^Edit eligibility/ }).click();
  const dialog = page.getByRole('dialog', { name: 'Edit eligibility' });
  const changed = await team.owner.request(`${LIST}/${team.company.workspace}/eligibility`, {
    method: 'PUT',
    body: { version: team.company.version, entitled: false, licenceVerified: true },
  });
  expect(changed.status).toBe(200);
  await dialog.getByRole('checkbox', { name: 'Licence verified' }).uncheck();
  await dialog.getByRole('button', { name: 'Turn off and save', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText(/This company.s settings changed/);
  await expect(dialog.getByRole('checkbox', { name: 'Website entitled' })).not.toBeChecked();
  await expect(dialog.getByRole('checkbox', { name: 'Licence verified' })).toBeChecked();
});

test('company Admins and staff cannot see the Companies tab or read the list', async ({
  browser,
}) => {
  const team = await settingsTeam('companies-access');
  for (const member of [team.admin, team.one]) {
    const context = await browser.newContext();
    try {
      const page = await context.newPage();
      const reads = [];
      page.on('request', (request) => {
        if (request.url().includes('/api/crm/platform/websites/companies'))
          reads.push(request.url());
      });
      await signInMember(page, member.user.email);
      await page.goto('/#/platform-website');
      await expect(page.getByRole('tab', { name: /^Companies/ })).toHaveCount(0);
      await expect(page.getByLabel('Search companies', { exact: true })).toHaveCount(0);
      expect(reads).toEqual([]);
    } finally {
      await context.close();
    }
  }
});
