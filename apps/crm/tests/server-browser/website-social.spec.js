import { test, expect } from './fixtures.js';
import { memberPage } from './assign-helpers.js';
import { ok, websitePath } from '../api/website-helpers.mjs';
import {
  currentDraft,
  openWebsite,
  resolveSite,
  settingsTeam,
} from './website-settings-helpers.js';

const agentLink = 'https://instagram.com/synthetic.agent';
const companyLink = 'https://instagram.com/synthetic.company';
const savedProfile = async (session, member) =>
  ok(await session.request(websitePath(session, `/profiles/${member.user.id}`))).profile;
const publicSocial = async (site) => (await resolveSite(site)).value?.data?.content?.social;

test('a member adds their own Instagram link; the Admin sees it as text and keeps it', async ({
  page,
  browser,
}) => {
  const team = await settingsTeam('social');
  const name = team.one.user.name;
  const staff = await memberPage(browser, team.one.user.email);
  try {
    // The member types the address without https://; it is saved in its canonical form.
    await staff.page.goto('/#/my-profile');
    const own = staff.page.getByRole('region', { name: 'Website profile', exact: true });
    await own.getByRole('textbox', { name: 'Specialty', exact: true }).fill('Synthetic marinas');
    const links = own.getByRole('group', { name: 'Your social links (optional)', exact: true });
    const instagram = links.getByRole('textbox', { name: 'Instagram', exact: true });
    await instagram.fill('instagram.com/synthetic.agent');
    await own.getByRole('button', { name: 'Save website profile', exact: true }).click();
    await expect(own.getByText('Your website profile was saved.')).toBeVisible();
    await expect(instagram).toHaveValue(agentLink);
    expect((await savedProfile(team.admin, team.one)).body.social).toEqual({
      instagram: agentLink,
    });
  } finally {
    await staff.context.close();
  }

  // The Admin's Edit profile shows the link as plain text, never an input or a link.
  await openWebsite(page, team.admin);
  await page.getByRole('tab', { name: 'Team', exact: true }).click();
  const table = page.getByRole('table', { name: 'Website team', exact: true });
  const row = table.getByRole('row').filter({ hasText: name });
  await row.getByRole('button', { name: `Edit profile for ${name}`, exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Edit website profile' });
  await expect(dialog.getByText(agentLink, { exact: true })).toBeVisible();
  await expect(
    dialog.getByText(
      `Only ${name} changes their public WhatsApp, email and social links, from My profile.`,
    ),
  ).toBeVisible();
  await expect(dialog.getByRole('textbox', { name: 'Instagram' })).toHaveCount(0);
  await expect(dialog.getByRole('link')).toHaveCount(0);
  await dialog.getByRole('textbox', { name: 'Specialty', exact: true }).fill('Synthetic villas');
  await dialog.getByRole('button', { name: 'Save profile', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  const kept = await savedProfile(team.admin, team.one);
  expect(kept.body.specialty).toBe('Synthetic villas');
  expect(kept.body.social).toEqual({ instagram: agentLink });
});

test('the Admin publishes a company Instagram link; an invalid link saves nothing', async ({
  page,
}) => {
  const team = await settingsTeam('social-site');
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await openWebsite(page, team.admin);
  const group = page.getByRole('group', { name: 'Social links', exact: true });
  const instagram = group.getByRole('textbox', { name: 'Instagram', exact: true });
  const problem = page.getByText('Enter an Instagram link, like https://instagram.com/yourname');

  // A look-alike host is refused beside the field and nothing is saved or published.
  await instagram.fill('https://instagram.com.evil.ae/x');
  await page.getByRole('button', { name: 'Save & publish', exact: true }).click();
  await expect(problem).toBeVisible();
  await expect(instagram).toHaveAttribute('aria-invalid', 'true');
  await expect(instagram).toBeFocused();
  expect((await currentDraft(team.admin)).draft).toBeNull();
  expect(await publicSocial(team.company)).toBeUndefined();

  // Corrected without https://, the Review lists the canonical link before it is published.
  await instagram.fill('instagram.com/synthetic.company');
  await expect(problem).toHaveCount(0);
  await page.getByRole('button', { name: 'Review content', exact: true }).click();
  const review = page.getByRole('dialog', { name: 'Content review', exact: true });
  await expect(review.getByText(companyLink, { exact: true })).toBeVisible();
  await expect(review.getByRole('link')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(review).toHaveCount(0);
  await page.getByRole('button', { name: 'Save & publish', exact: true }).click();
  await expect.poll(() => publicSocial(team.company)).toEqual({ instagram: companyLink });
  await expect(instagram).toHaveValue(companyLink);
  expect(errors).toEqual([]);
});
