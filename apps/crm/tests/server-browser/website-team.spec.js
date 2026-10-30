import { test, expect } from './fixtures.js';
import { memberPage } from './assign-helpers.js';
import { ok, websitePath } from '../api/website-helpers.mjs';
import { openWebsite, settingsTeam } from './website-settings-helpers.js';

const savedProfile = async (session, member) =>
  ok(await session.request(websitePath(session, `/profiles/${member.user.id}`))).profile;

test('staff agree in My profile; the Admin allows, edits and stops publishing from the Team tab', async ({
  page,
  browser,
}) => {
  const team = await settingsTeam('team');
  const name = team.one.user.name;
  const staff = await memberPage(browser, team.one.user.email);
  try {
    // The staff member sets up their own website profile and gives consent in My profile.
    await staff.page.goto('/#/my-profile');
    const own = staff.page.getByRole('region', { name: 'Website profile', exact: true });
    await expect(own).toContainText('Not on the website yet');
    await expect(own).toContainText('Ask your Admin for publishing access');
    await expect(own.getByLabel('Public name')).toHaveValue(name);
    await own.getByLabel('Specialty').fill('Synthetic marina apartments');
    await own.getByLabel('Public WhatsApp').fill('+971501234567');
    await own.getByRole('checkbox', { name: /^I agree that my name, specialty/ }).check();
    await own.getByRole('button', { name: 'Save website profile', exact: true }).click();
    await expect(own.getByText('Your website profile was saved.')).toBeVisible();
    await expect(own).toContainText('Public · 0 live listings');
    const agreed = await savedProfile(team.admin, team.one);
    expect(agreed).toMatchObject({ consent: true, active: true, canPublish: false });
    expect(agreed.body.publicWhatsApp).toBe('+971501234567');
  } finally {
    await staff.context.close();
  }

  // The Admin finds them as Public on Website → Team; their own row always publishes.
  await openWebsite(page, team.admin);
  await page.getByRole('tab', { name: 'Team', exact: true }).click();
  const table = page.getByRole('table', { name: 'Website team', exact: true });
  const row = table.getByRole('row').filter({ hasText: name });
  await expect(row).toContainText('Public');
  await expect(row).toContainText('Given');
  await expect(row).toContainText('Not allowed');
  await expect(row).toContainText('0 live listings');
  const adminRow = table.getByRole('row').filter({ hasText: team.admin.user.name });
  await expect(adminRow).toContainText('Admin · always');
  await expect(adminRow.getByRole('button', { name: 'Change in My profile' })).toBeVisible();

  // Allow publishing takes effect at once.
  await row.getByRole('button', { name: `Allow publishing for ${name}`, exact: true }).click();
  await expect(page.getByText(`${name} can now publish to the website.`)).toBeVisible();
  await expect(row).toContainText('Allowed');
  expect((await savedProfile(team.admin, team.one)).canPublish).toBe(true);

  // Edit profile: consent is read-only for someone else and stays as the member left it.
  await row.getByRole('button', { name: `Edit profile for ${name}`, exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Edit website profile' });
  await expect(dialog.getByText(`Only ${name} can agree to this, from My profile.`)).toBeVisible();
  await expect(dialog.getByRole('checkbox')).toHaveCount(0);
  await dialog.getByLabel('Specialty').fill('Synthetic Palm villas');
  await dialog.getByRole('button', { name: 'Save profile', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByText(`${name}’s website profile was saved.`)).toBeVisible();
  let profile = await savedProfile(team.admin, team.one);
  expect(profile.body.specialty).toBe('Synthetic Palm villas');
  expect(profile).toMatchObject({ consent: true, active: true, canPublish: true });

  // Stop publishing asks first, names the live-listing impact and keeps the profile.
  await row.getByRole('button', { name: `Stop publishing for ${name}`, exact: true }).click();
  const confirm = page.getByRole('dialog', { name: 'Stop publishing' });
  await expect(confirm).toContainText(
    `Stop ${name} publishing? Their 0 live listings leave the website now. Their profile stays.`,
  );
  await confirm.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(confirm).toHaveCount(0);
  expect((await savedProfile(team.admin, team.one)).canPublish).toBe(true);
  await row.getByRole('button', { name: `Stop publishing for ${name}`, exact: true }).click();
  await confirm.getByRole('button', { name: 'Stop publishing', exact: true }).click();
  await expect(page.getByText(`${name} can no longer publish to the website.`)).toBeVisible();
  await expect(row).toContainText('Not allowed');
  profile = await savedProfile(team.admin, team.one);
  expect(profile).toMatchObject({ consent: true, active: true, canPublish: false });
});
