import { openSection } from './assign-helpers.js';
import { expect, test } from './fixtures.js';
import { signIn } from './helpers.js';

const hintText = 'Include the country code, such as +971 50 123 4567.';

function phoneField(page) {
  const phone = page.getByLabel('Phone', { exact: true });
  return { phone, field: page.locator('.field').filter({ has: phone }) };
}

test('field hints follow focus, typing and the member preference', async ({ page }) => {
  await signIn(page);
  await page.getByRole('button', { name: 'Add client', exact: true }).click();
  let { phone, field } = phoneField(page);
  const info = () => field.getByRole('button', { name: 'Show field guidance' });

  // Automatic hints appear on focus and are described to assistive technology.
  await phone.focus();
  await expect(field.getByRole('note')).toContainText(hintText);
  await expect(phone).toHaveAttribute('aria-describedby', /-guidance/);
  // Typing hides the hint; the information button reopens it.
  await phone.fill('+9715');
  await expect(field.getByRole('note')).toHaveCount(0);
  await info().click();
  await expect(field.getByRole('note')).toContainText(hintText);
  await info().click();
  await expect(field.getByRole('note')).toHaveCount(0);
  await phone.fill('');
  await page.getByRole('button', { name: 'Close record editor', exact: true }).click();

  // Turning the preference off stops automatic hints but keeps the icon.
  await page.goto('/#/my-profile');
  const toggle = page.getByRole('switch', { name: 'Show field hints automatically' });
  await expect(toggle).toBeChecked();
  await toggle.uncheck();
  await expect(page.getByText('Saved. Automatic field hints are off.')).toBeVisible();
  await openSection(page, 'Clients');
  await page.getByRole('button', { name: 'Add client', exact: true }).click();
  ({ phone, field } = phoneField(page));
  await phone.focus();
  await expect(field.getByRole('note')).toHaveCount(0);
  await info().click();
  await expect(field.getByRole('note')).toContainText(hintText);
  await info().click();

  // The reopened hint also works in dark mode on a phone-sized viewport.
  await page.getByRole('button', { name: /Switch to dark mode/ }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await info().click();
  await expect(field.getByRole('note')).toBeVisible();
  await phone.fill('');
  await page.getByRole('button', { name: 'Close record editor', exact: true }).click();

  // Leave the shared fixture account with automatic hints on for other scenarios.
  await page.goto('/#/my-profile');
  await toggle.check();
  await expect(page.getByText('Saved. Automatic field hints are on.')).toBeVisible();
});
