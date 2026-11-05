import { test, expect } from './fixtures.js';
import { newCompany } from '../api/company-helpers.mjs';
import { apply, approve, ready } from '../api/marketplace-helpers.mjs';
import { signInMember } from './assign-helpers.js';

test('the Admin saves company details, checked, beside the marketplace and seats', async ({
  page,
}) => {
  const { admin } = await newCompany('browser-company');
  await signInMember(page, admin.email);
  await page.goto('/#/company');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Company');
  const details = page.getByRole('region', { name: 'Company details', exact: true });
  const save = page.getByRole('button', { name: 'Save', exact: true });
  await expect(save).toBeDisabled();
  await expect(page.getByText('Version 1', { exact: true })).toBeVisible();

  await details.getByLabel('Company name', { exact: true }).fill('Synthetic Harbour Homes');
  await details.getByLabel('Trade licence number', { exact: true }).fill(' DED 1043378 ');
  await details.getByLabel('Emirate', { exact: true }).selectOption('dubai');
  const phone = details.getByLabel('Office phone', { exact: true });
  await phone.fill('045552210');
  await details
    .getByLabel('Office address', { exact: true })
    .fill('Office 1204, Synthetic Plaza, Dubai Marina');
  await expect(page.getByText('You have unsaved changes.')).toBeVisible();
  await save.click();
  await expect(details.getByText(/Enter a phone number including country code/)).toBeVisible();
  await expect(phone).toBeFocused();
  await phone.fill('+971 4 555 2210');
  await save.click();
  await expect(page.getByText('Your company details were saved.')).toBeVisible();
  await expect(phone).toHaveValue('+97145552210');

  await page.reload();
  await expect(details.getByLabel('Trade licence number', { exact: true })).toHaveValue(
    'DED 1043378',
  );
  await expect(page.getByText('Version 2', { exact: true })).toBeVisible();
  // Discard returns to the saved details.
  await details.getByLabel('Company name', { exact: true }).fill('Not kept');
  await page.getByRole('button', { name: 'Discard changes', exact: true }).click();
  await expect(details.getByLabel('Company name', { exact: true })).toHaveValue(
    'Synthetic Harbour Homes',
  );

  // The mockup's side cards: where the marketplace stands, and the Free plan's seats.
  const market = page.getByRole('region', { name: 'Marketplace', exact: true });
  await expect(market).toContainText('Not applied yet');
  await market.getByRole('button', { name: 'Open Marketplace' }).click();
  await expect(page).toHaveURL(/#\/marketplace$/);
  await page.goBack();
  const plan = page.getByRole('region', { name: 'Plan and seats', exact: true });
  await expect(plan).toContainText('Free');
  await expect(plan).toContainText('1 of 3 used');
});

test('an approved company turns the marketplace off, after confirming, and on again', async ({
  page,
}) => {
  test.setTimeout(120000);
  const { owner, admin } = await newCompany('browser-company-market');
  await ready(admin);
  await apply(admin);
  await approve(owner, admin);
  await signInMember(page, admin.email);
  await page.goto('/#/company');
  const market = page.getByRole('region', { name: 'Marketplace', exact: true });
  const toggle = market.getByRole('switch');
  await expect(market).toContainText('On for every member');
  await expect(toggle).toBeChecked();
  await toggle.click();
  const ask = market.getByRole('group', { name: 'Turn the marketplace off for every member?' });
  await ask.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(toggle).toBeChecked();
  await toggle.click();
  await ask.getByRole('button', { name: 'Turn off', exact: true }).click();
  await expect(market).toContainText('Off for every member');
  await expect(toggle).not.toBeChecked();
  await toggle.click();
  await expect(market).toContainText('On for every member');
});
