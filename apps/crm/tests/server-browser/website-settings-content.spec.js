import { test, expect } from './fixtures.js';
import { noPageOverflow, setTheme } from './assign-helpers.js';
import {
  allowCompany,
  currentDraft,
  currentSite,
  expectPublicHero,
  openWebsite,
  resolveSite,
  settingsTeam,
} from './website-settings-helpers.js';

test('a company Admin privately reviews a draft, publishes it, and saves the next generation', async ({
  page,
}) => {
  const team = await settingsTeam('publish');
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await openWebsite(page, team.admin);
  const headline = page.getByLabel('Homepage headline', { exact: true });
  await expect(headline).toHaveValue('Published company introduction');
  await headline.fill('A private draft introduction');
  await page.getByRole('button', { name: 'Save draft', exact: true }).click();
  await expect(
    page.getByText('Draft saved privately. Public content has not changed.'),
  ).toBeVisible();
  const firstDraft = await currentDraft(team.admin);
  expect(firstDraft.draft.site.content.heroTitle).toBe('A private draft introduction');
  await expectPublicHero(team.company, 'Published company introduction');
  await page.getByRole('button', { name: 'Review content', exact: true }).click();
  const review = page.getByRole('dialog', { name: 'Content review', exact: true });
  await expect(review).toBeVisible();
  await expect(review).toContainText('A private draft introduction');
  await page.keyboard.press('Escape');
  await expect(review).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Review content', exact: true })).toBeFocused();
  await page.getByRole('button', { name: 'Publish saved draft', exact: true }).click();
  await expect(
    page.getByText(
      'Content published. Website availability still follows its setup and visibility.',
    ),
  ).toBeVisible();
  await expectPublicHero(team.company, 'A private draft introduction');
  const afterPublish = await currentDraft(team.admin);
  expect(afterPublish.draft).toBeNull();
  expect(afterPublish.version).toBeGreaterThan(firstDraft.version);
  await headline.fill('A second public introduction');
  await page.getByRole('button', { name: 'Save & publish', exact: true }).click();
  await expectPublicHero(team.company, 'A second public introduction');
  expect((await currentDraft(team.admin)).version).toBeGreaterThan(afterPublish.version);
  await page.reload();
  await expect(headline).toHaveValue('A second public introduction');
  expect(errors).toEqual([]);
});

test('first company setup stays unavailable until eligibility is configured', async ({ page }) => {
  const team = await settingsTeam('setup', { site: false });
  await openWebsite(page, team.admin);
  await page.getByLabel('Public website name', { exact: true }).fill('Synthetic New Company');
  await page
    .getByLabel('Website address name', { exact: true })
    .fill(`new-${team.admin.user.id.slice(0, 8)}`);
  await page.getByLabel('Company initials', { exact: true }).fill('NC');
  await page.getByLabel('Public service area', { exact: true }).fill('Dubai');
  await page
    .getByLabel('Company introduction', { exact: true })
    .fill('A synthetic company introduction.');
  await page.getByLabel('Homepage headline', { exact: true }).fill('A new company website');
  await page.getByRole('button', { name: 'Save & publish', exact: true }).click();
  await expect
    .poll(async () => (await currentSite(team.admin))?.name)
    .toBe('Synthetic New Company');
  const published = await currentSite(team.admin);
  expect(published.entitled).toBe(false);
  expect((await resolveSite(published)).status).toBe(404);
  await expect(page.getByRole('link', { name: /open.*website|view.*website/i })).toHaveCount(0);
  await allowCompany(team.owner, published);
  await page.reload();
  await expectPublicHero(published, 'A new company website');
});

test('website settings reflow in both themes and theme choices work by keyboard', async ({
  page,
}, testInfo) => {
  const team = await settingsTeam('layout');
  await openWebsite(page, team.admin);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const signature = page.getByRole('radio', { name: /Signature/ });
  await signature.focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('radio', { name: /Modern/ })).toBeChecked();
  await page
    .getByLabel('Public website name', { exact: true })
    .fill('Synthetic International Property Advisory and Relocation Company');
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 900 });
    for (const theme of ['dark', 'light']) {
      await setTheme(page, theme);
      await noPageOverflow(page);
      await expect(page.getByRole('button', { name: 'Save draft', exact: true })).toBeEnabled();
      await page.screenshot({
        path: testInfo.outputPath(`website-settings-${width}-${theme}.png`),
        fullPage: true,
      });
    }
  }
});
