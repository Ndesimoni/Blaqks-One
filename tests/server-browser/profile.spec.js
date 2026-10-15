import { test, expect } from './fixtures.js';
import { login } from '../api/helpers.mjs';
import { activate, invite } from '../api/team-helpers.mjs';
import { memberPage, noPageOverflow, setTheme, signInMember } from './assign-helpers.js';

const signedOut = (page) =>
  expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();

async function openProfile(page) {
  await page.goto('/#/my-profile');
  await expect(page.locator('.page-heading h1')).toHaveText('My profile');
  await expect(page.getByRole('heading', { name: 'Account details' })).toBeVisible();
}

const sessionRows = (page) =>
  page.getByRole('list', { name: 'Signed-in devices' }).getByRole('listitem');

test('members edit their details, change their password and manage their sessions', async ({
  page,
  browser,
}) => {
  const admin = await login('admin-a');
  const invited = await invite(admin, 'browser-profile');
  await activate(invited);
  await signInMember(page, invited.email);
  await openProfile(page);
  const details = page.getByRole('region', { name: 'Account details' });
  await expect(details).toContainText(invited.email);
  await expect(details).toContainText('Contact your Admin to change.');
  await expect(details).toContainText('Fixture Admin A');

  // Name and phone: Save and Cancel wait for a change, and Cancel restores the saved values.
  const save = page.getByRole('button', { name: 'Save changes' });
  const original = await page.getByLabel('Full name *').inputValue();
  await expect(save).toBeDisabled();
  await page.getByLabel('Full name *').fill('Discarded Name');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.getByLabel('Full name *')).toHaveValue(original);
  await expect(save).toBeDisabled();
  await page.getByLabel('Full name *').fill('Browser Profile Edited');
  await page.getByLabel('Phone number *').fill('0501234567');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByText(/Enter a phone number including country code/)).toBeVisible();
  await page.getByLabel('Phone number *').fill('+971507654321');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByText('Your details were saved.')).toBeVisible();
  await expect(page.getByLabel('Full name *')).toHaveValue('Browser Profile Edited');
  // The signed-in identity shows the saved name straight away.
  await expect(page.locator('.side-footer strong')).toHaveText('Browser Profile Edited');

  // Sessions list and signing out other devices.
  const other = await memberPage(browser, invited.email);
  await page.reload();
  await expect(sessionRows(page)).toHaveCount(3);
  await expect(page.getByText('This device', { exact: true })).toHaveCount(1);
  await expect(sessionRows(page).filter({ hasText: 'This device' })).toContainText('Chrome');
  await page.getByRole('button', { name: 'Sign out all other devices' }).click();
  await page.getByRole('button', { name: 'Sign out other devices', exact: true }).click();
  await expect(page.getByText('2 other devices were signed out.')).toBeVisible();
  await expect(sessionRows(page)).toHaveCount(1);
  await other.page.reload();
  await signedOut(other.page);
  await other.context.close();

  // Password: the rule list, a weak password and a wrong current password.
  const second = await memberPage(browser, invited.email);
  const current = page.getByLabel('Current password', { exact: true });
  const next = page.getByLabel('New password', { exact: true });
  const confirm = page.getByLabel('Confirm new password', { exact: true });
  await current.fill('Team123!');
  await next.fill('weakpass');
  const rules = page.getByRole('list', { name: 'Password requirements' });
  await expect(rules).toContainText('An uppercase letter (not met yet)');
  await expect(rules).toContainText('A lowercase letter (met)');
  await expect(page.locator('#profile-password-strength')).toHaveText('Strength: Fair');
  await page.getByRole('button', { name: 'Show new password' }).click();
  await expect(next).toHaveAttribute('type', 'text');
  await confirm.fill('weakpass');
  await page.getByRole('button', { name: 'Change password', exact: true }).click();
  await expect(page.locator('#profile-password-next-error')).toContainText('Use at least 8');
  await expect(next).toBeFocused();
  await current.fill('Wrong123!');
  await next.fill('Browser1!pw');
  await confirm.fill('Browser1!pw');
  await page.getByRole('button', { name: 'Change password', exact: true }).click();
  await expect(page.locator('#profile-password-current-error')).toHaveText(
    'Current password is incorrect.',
  );
  await expect(current).toHaveValue('');
  await expect(page.getByRole('heading', { name: 'Account details' })).toBeVisible();

  // A successful change keeps this device signed in and signs out the second context.
  await current.fill('Team123!');
  await next.fill('Browser1!pw');
  await confirm.fill('Browser1!pw');
  await page.getByRole('button', { name: 'Change password', exact: true }).click();
  await expect(page.getByText('Password changed. Other devices were signed out.')).toBeVisible();
  await expect(sessionRows(page)).toHaveCount(1);
  await second.page.reload();
  await signedOut(second.page);
  await second.context.close();
  // The rotated CSRF token is in use: another save succeeds without signing in again.
  await page.getByLabel('Full name *').fill('Browser Profile Final');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByText('Your details were saved.')).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('Full name *')).toHaveValue('Browser Profile Final');
  await expect(page.getByText(/^Last changed /)).toBeVisible();
  await page.screenshot({ path: test.info().outputPath('profile-desktop.png'), fullPage: true });
});

test('My profile reflows on mobile and desktop in both themes', async ({ page }, testInfo) => {
  const admin = await login('admin-a');
  const invited = await invite(admin, 'browser-profile-mobile');
  await activate(invited);
  await signInMember(page, invited.email);
  for (const [width, height] of [
    [390, 844],
    [1280, 900],
  ])
    for (const theme of ['dark', 'light']) {
      await page.setViewportSize({ width, height });
      await setTheme(page, theme);
      await openProfile(page);
      await expect(sessionRows(page).first()).toBeVisible();
      await noPageOverflow(page);
      const path = testInfo.outputPath(`profile-${width}-${theme}.png`);
      await page.screenshot({ path, fullPage: true });
    }
});
