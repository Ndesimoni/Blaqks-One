import { test, expect } from './fixtures.js';
import { signIn } from './helpers.js';
import { signInMember } from './assign-helpers.js';
import { ok } from '../api/website-helpers.mjs';
import {
  currentSite,
  expectPublicHero,
  openWebsite,
  settingsTeam,
} from './website-settings-helpers.js';

test('staff and foreign workspace links cannot load company website controls', async ({
  page,
  browser,
}) => {
  const team = await settingsTeam('access');
  const staffContext = await browser.newContext();
  try {
    const staffPage = await staffContext.newPage();
    const websiteReads = [];
    staffPage.on('request', (request) => {
      if (/\/api\/crm\/workspaces\/[^/]+\/website/.test(request.url()))
        websiteReads.push(request.url());
    });
    await signInMember(staffPage, team.one.user.email);
    await staffPage.goto('/#/website');
    await expect(
      staffPage.getByRole('heading', { name: 'Access is restricted', exact: true }),
    ).toBeVisible();
    await expect(staffPage.getByRole('button', { name: 'Website', exact: true })).toHaveCount(0);
    await expect(staffPage.getByLabel('Public website name', { exact: true })).toHaveCount(0);
    expect(websiteReads).toEqual([]);
    await openWebsite(page, team.admin);
    const foreignReads = [];
    page.on('request', (request) => {
      if (request.url().includes(`/workspaces/${team.other.user.workspaceId}/website`))
        foreignReads.push(request.url());
    });
    await page.goto(`/#/website?workspace=${team.other.user.workspaceId}`);
    await expect(
      page.getByRole('heading', { name: 'Workspace access is restricted', exact: true }),
    ).toBeVisible();
    await expect(page.getByLabel('Public website name', { exact: true })).toHaveCount(0);
    expect(foreignReads).toEqual([]);
  } finally {
    await staffContext.close();
  }
});

test('platform content stays separate from the selected company workspace', async ({ page }) => {
  const team = await settingsTeam('platform');
  await signIn(page, 'owner');
  const companyReads = [];
  page.on('request', (request) => {
    if (/\/api\/crm\/workspaces\/[^/]+\/website/.test(request.url()))
      companyReads.push(request.url());
  });
  await page.goto(`/#/platform-website?workspace=${team.admin.user.workspaceId}`);
  await expect(page.locator('.page-heading h1')).toHaveText('Platform website');
  const headline = page.getByLabel('Homepage headline', { exact: true });
  await expect(headline).toHaveValue('Published platform introduction');
  await expect(page.getByLabel('Company initials', { exact: true })).toHaveCount(0);
  await expect(page.getByLabel('Platform hostname', { exact: true })).toHaveValue(
    'blaqks.localhost',
  );
  await headline.fill('A platform-only saved draft');
  await page.getByRole('button', { name: 'Save draft', exact: true }).click();
  await expect(
    page.getByText('Draft saved privately. Public content has not changed.'),
  ).toBeVisible();
  const saved = ok(await team.owner.request('/platform/websites/general/draft'));
  expect(saved.draft.site.content.heroTitle).toBe('A platform-only saved draft');
  await expectPublicHero(team.platform, 'Published platform introduction');
  expect((await currentSite(team.admin)).content.heroTitle).toBe('Published company introduction');
  await page.getByRole('button', { name: 'Publish saved draft', exact: true }).click();
  await expectPublicHero(team.platform, 'A platform-only saved draft');
  await page.goto(`/#/platform-website?workspace=${team.other.user.workspaceId}`);
  await expect(headline).toHaveValue('A platform-only saved draft');
  expect(companyReads).toEqual([]);
});
