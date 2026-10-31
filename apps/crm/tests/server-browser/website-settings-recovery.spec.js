import { test, expect } from './fixtures.js';
import { put, ok, websitePath } from '../api/website-helpers.mjs';
import {
  companyInput,
  currentDraft,
  currentSite,
  expectPublicHero,
  openWebsite,
  settingsTeam,
} from './website-settings-helpers.js';

test('a competing draft keeps local edits and navigation requires discarding them explicitly', async ({
  page,
}) => {
  const team = await settingsTeam('conflict');
  await openWebsite(page, team.admin);
  const headline = page.getByLabel('Homepage headline', { exact: true });
  await headline.fill('Unsaved local headline');
  ok(
    await put(team.admin, websitePath(team.admin, '/draft'), {
      version: 0,
      site: companyInput(team.company, { heroTitle: 'A competing saved draft' }),
    }),
  );
  await page.getByRole('button', { name: 'Save draft', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText(/changed|reload|another/i);
  await expect(headline).toHaveValue('Unsaved local headline');
  await expectPublicHero(team.company, 'Published company introduction');
  page.once('dialog', (dialog) => dialog.dismiss());
  await page
    .getByRole('navigation', { name: 'CRM sections' })
    .getByRole('button', { name: 'Clients', exact: true })
    .click();
  await expect(page).toHaveURL(/#\/website$/);
  await expect(headline).toHaveValue('Unsaved local headline');
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Reload latest', exact: true }).click();
  await expect(headline).toHaveValue('A competing saved draft');
  expect((await currentDraft(team.admin)).draft.site.content.heroTitle).toBe(
    'A competing saved draft',
  );
});

test('loading failure offers retry and never substitutes sample website content', async ({
  page,
}) => {
  const team = await settingsTeam('retry');
  let fail = true;
  await page.route('**/api/crm/workspaces/*/website', (route) => {
    if (fail && route.request().method() === 'GET') {
      return route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Synthetic website load failure.' }),
      });
    }
    return route.continue();
  });
  await openWebsite(page, team.admin);
  await expect(page.getByRole('alert')).toContainText('Synthetic website load failure.');
  await expect(page.getByLabel('Homepage headline', { exact: true })).toHaveCount(0);
  fail = false;
  await page.getByRole('button', { name: 'Retry', exact: true }).click();
  await expect(page.getByLabel('Homepage headline', { exact: true })).toHaveValue(
    'Published company introduction',
  );
});

test('a draft based on an old published version needs explicit recovery before publishing', async ({
  page,
}) => {
  const team = await settingsTeam('stale-site');
  ok(
    await put(team.admin, websitePath(team.admin, '/draft'), {
      version: 0,
      site: companyInput(team.company, { heroTitle: 'Old-version private draft' }),
    }),
  );
  ok(
    await put(
      team.admin,
      websitePath(team.admin),
      companyInput(team.company, { heroTitle: 'A newer published headline' }),
    ),
  );
  await openWebsite(page, team.admin);
  const headline = page.getByLabel('Homepage headline', { exact: true });
  await expect(headline).toHaveValue('Old-version private draft');
  await expect(
    page.getByRole('button', { name: 'Publish saved draft', exact: true }),
  ).toBeDisabled();
  await expectPublicHero(team.company, 'A newer published headline');
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Start from published content', exact: true }).click();
  await expect(headline).toHaveValue('A newer published headline');
  await headline.fill('Reviewed replacement headline');
  await page.getByRole('button', { name: 'Save & publish', exact: true }).click();
  await expectPublicHero(await currentSite(team.admin), 'Reviewed replacement headline');
});
