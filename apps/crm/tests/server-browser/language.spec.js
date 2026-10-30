import { test, expect } from './fixtures.js';
import { login } from '../api/helpers.mjs';
import { activate, invite } from '../api/team-helpers.mjs';
import { noPageOverflow, signInMember } from './assign-helpers.js';

// The connected browser harness runs Vite with VITE_I18N_PREVIEW=true (test-crm-api.mjs).
const root = (page) => page.locator('html');
const arabic = (page) => page.getByRole('radio', { name: /العربية/ });
const english = (page) => page.getByRole('radio', { name: /^English/ });

async function openProfile(page) {
  await page.goto('/#/my-profile');
  await expect(page.locator('.page-heading h1')).toHaveText('My profile');
}

test('members switch My profile to Arabic (preview) and back, kept across reloads', async ({
  page,
}) => {
  const admin = await login('admin-a');
  const invited = await invite(admin, 'browser-language');
  await activate(invited);
  await signInMember(page, invited.email);
  await openProfile(page);
  await expect(root(page)).toHaveAttribute('lang', 'en');
  await expect(root(page)).toHaveAttribute('dir', 'ltr');
  const section = page.getByRole('region', { name: 'Language' });
  await expect(section).toContainText('Preview — most screens are still in English.');
  await expect(english(page)).toBeChecked();
  await expect(arabic(page)).not.toBeChecked();

  // A failed save keeps English and offers Try again, which repeats the same choice.
  await page.route('**/api/crm/auth/account/language', (route) =>
    route.fulfill({ status: 500, contentType: 'application/json', body: '{}' }),
  );
  await arabic(page).check();
  await expect(page.getByRole('alert')).toContainText('Your language could not be saved.');
  await expect(english(page)).toBeChecked();
  await expect(root(page)).toHaveAttribute('dir', 'ltr');
  await page.unroute('**/api/crm/auth/account/language');
  await page.getByRole('button', { name: 'Try again' }).click();

  await expect(root(page)).toHaveAttribute('lang', 'ar');
  await expect(root(page)).toHaveAttribute('dir', 'rtl');
  const translated = page.getByRole('region', { name: 'اللغة' });
  await expect(translated.getByRole('heading', { name: 'اللغة' })).toBeVisible();
  await expect(translated).toContainText('تم الحفظ. يستخدم النظام الآن العربية.');
  await expect(translated).toContainText('معاينة — معظم الشاشات لا تزال باللغة الإنجليزية.');
  await expect(page.getByRole('group', { name: 'لغة الواجهة' })).toBeVisible();
  await expect(arabic(page)).toBeChecked();
  await noPageOverflow(page);
  const session = await (await page.request.get('/api/crm/auth/session')).json();
  expect(session.user.language).toBe('ar');

  await page.reload();
  await expect(root(page)).toHaveAttribute('lang', 'ar');
  await expect(root(page)).toHaveAttribute('dir', 'rtl');
  await expect(page.getByRole('heading', { name: 'اللغة' })).toBeVisible();
  await expect(arabic(page)).toBeChecked();

  await page.getByRole('radio', { name: /^English/ }).check();
  await expect(root(page)).toHaveAttribute('lang', 'en');
  await expect(root(page)).toHaveAttribute('dir', 'ltr');
  await expect(section).toContainText('Saved. The CRM now uses English.');
  await expect(english(page)).toBeChecked();
  await page.reload();
  await expect(root(page)).toHaveAttribute('lang', 'en');
  await expect(page.getByRole('heading', { name: 'Language' })).toBeVisible();
});
