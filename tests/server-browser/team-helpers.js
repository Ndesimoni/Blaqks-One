import { expect } from '@playwright/test';

export async function openTeam(page) {
  await page.goto('/#/team-access');
  await expect(page.getByRole('heading', { name: 'Team', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Invite teammate', exact: true })).toBeEnabled();
}

export async function startInvitation(page, suffix, admin = false) {
  await page.getByRole('button', { name: 'Invite teammate', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Invite teammate' });
  await dialog.getByLabel('Full name').fill(`Browser ${suffix}`);
  await dialog.getByLabel('Email address').fill(`${suffix}@browser-team.test`);
  await dialog.getByLabel('Phone number').fill('+971501234567');
  if (admin) await dialog.getByLabel('Account type').selectOption('admin');
  await dialog.getByRole('button', { name: 'Continue', exact: true }).click();
  return dialog;
}

export async function finishInvitation(page, dialog) {
  await dialog.getByRole('button', { name: 'Continue', exact: true }).click();
  await dialog.getByRole('button', { name: 'Create invitation', exact: true }).click();
  const ready = page.getByRole('dialog', { name: 'Invitation ready' });
  await expect(ready).toBeVisible();
  return ready.getByLabel('Activation link').inputValue();
}

export async function activateInNewContext(browser, link, email, password = 'Team123!') {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(link);
  await expect(page.getByRole('heading', { name: 'Join your team' })).toBeVisible();
  await page.getByLabel('Choose password').fill(password);
  await page.getByLabel('Confirm password').fill(password);
  await page.getByRole('button', { name: 'Activate account', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Account activated' })).toBeVisible();
  await page.getByRole('button', { name: 'Go to sign in', exact: true }).click();
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  return { context, page };
}

export async function closeInvitation(page) {
  page.once('dialog', (dialog) => dialog.accept());
  await page
    .getByRole('dialog', { name: 'Invitation ready' })
    .getByRole('button', { name: 'Done', exact: true })
    .click();
}
